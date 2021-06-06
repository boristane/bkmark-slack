import { AppHomeOpenedEvent, SayFn, SlackAction } from "@slack/bolt";
import logger from "logger";
import { ISlackUser } from "../models/slack-user";
import bookmarks from "../services/bookmarks";
import database from "../services/database/database";
import internalStore, { InternalEventTypes } from "../services/internal-store";

export async function handleAppHomeOpened(event: AppHomeOpenedEvent, client: any, say: SayFn) {
  logger.info("Handling the app_home_opened evemt", event);
  const { user: slackId } = event;

  const { team } = await client.team.info();
  const user = await database.getSlackUser(team.id, slackId);

  if (!user || !user.userId) {
    try {

      let slackTeam = await database.getSlackTeam(team.id);
      if (!slackTeam) {
        slackTeam = {
          id: team.id,
          domain: team.domain,
        };
        await database.createSlackTeam(slackTeam);
        const e = {
          uuid: team.id,
          data: { slackTeam },
          type: InternalEventTypes.slackTeamCreated,
        }
        await internalStore.createInternalEvent(e);
      }

      const slackUser: ISlackUser = {
        slackId,
        teamId: team.id,
        domain: team.domain,
      };

      await database.createSlackUser(slackUser);

      const e = {
        uuid: slackId,
        data: { slackUser },
        type: InternalEventTypes.slackUserCreated,
      }
      internalStore.createInternalEvent(e);

      const loginUrl = `http://localhost:8080/login?slackTeam=${team.id}&slackUser=${slackId}`;

      await say({
        blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `👋 Hi <@${slackId}> you're not logged in to Bkmark. Please log in to start syncing the links you share on Slack in Bkmark.`
            },
            "accessory": {
              "type": "image",
              "image_url": "https://d1apvrodb6vxub.cloudfront.net/og-image.png",
              "alt_text": "image"
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "Log in to Bkmark",
                  "emoji": true
                },
                "value": "log_in_button_click",
                "action_id": "log_in_button_click",
                "url": encodeURI(loginUrl),
              }
            ]
          }
        ],
        text: ``
      });
    } catch (error) {
      logger.error("There was a problem prompting a slack user to log-in", error);
    }
    return;
  }

  await client.views.publish({
    user_id: slackId,
    view: {
      "type": "home",
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "*Loading*\n\n"
          }
        },
      ],
    }
  });

  try {
    const bkmarkUser = await database.getUser(user.userId);
    const b = await bookmarks.getBookmarks({ userId: bkmarkUser.uuid });
    const sections: any[] = [];
    b.forEach(bookmark => {
      sections.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `<${bookmark.url}|*${bookmark.title || bookmark.metadata.title}*>\n${bookmark.notes || bookmark.metadata.description}`
        },
        // "accessory": {
        //   "type": "image",
        //   "image_url": bookmark.metadata.image,
        //   "alt_text": bookmark.title || bookmark.metadata.title || "",
        // }
      });
      sections.push({
        "type": "divider"
      });
    });
    const blocks = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*👋 Hi <@" + slackId + ">, find your recent bookmarks :bookmark:*\n\n"
        }
      },
      ...sections,
    ];

    await client.views.publish({
      user_id: slackId,
      view: {
        "type": "home",
        blocks,
      }
    });
  }
  catch (error) {
    logger.error("There was an error sending the recent bookmarks to a user", { error, event });
    await client.views.publish({
      user_id: slackId,
      view: {
        "type": "home",
        "text": "There was an issue fetching your bookmarks. Please try again. If the problem persists, please contact support."
      }
    });
  }
}

export async function handleLoginButtonClick(body: SlackAction, ack: Function, say: SayFn) {
  await ack();
  logger.info("Received a log_in_button_click action", body);
}
