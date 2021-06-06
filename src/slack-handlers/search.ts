import { SlashCommand } from "@slack/bolt";
import { ISlackUser } from "../models/slack-user";
import database from "../services/database/database";
import internalStore, { InternalEventTypes } from "../services/internal-store";
import logger from "logger";
import bookmarks from "../services/bookmarks";

export async function handleSearch(command: SlashCommand, client: any) {
  logger.info("Handling the command", { command });
  const { user_id: slackId } = command;

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

      await client.chat.postEphemeral({
        channel: command.channel_id,
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
        text: ``,
        user: slackId,
      });
    } catch (error) {
      logger.error("There was a problem prompting a slack user to log-in", error);
    }
    return;
  }

  try {
    const bkmarkUser = await database.getUser(user.userId);
    const b = await bookmarks.searchBookmarks({ userId: bkmarkUser.uuid, query: command.text });
    const sections: any[] = [];
    b.slice(0, 4).forEach(bookmark => {
      sections.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": ` <${bookmark.url}|*${bookmark.title || bookmark.metadata.title}*>\n${bookmark.notes || bookmark.metadata.description}`
        },
        // "accessory": {
        //   "type": "image",
        //   "image_url": bookmark.metadata.image,
        //   "alt_text": bookmark.title || bookmark.metadata.title || "",
        // }
      });
      sections.push({
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Send",
              "emoji": true
            },
            "value": `${bookmark.collection.uuid}#${bookmark.uuid}`,
            "action_id": "send_bookmark",
          },
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Open",
              "emoji": true
            },
            "value": `${bookmark.collection.uuid}#${bookmark.uuid}`,
            "action_id": "open_bookmark",
            "url": bookmark.url,
          },
        ]
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
          "text": "*Your search results:*\n\n"
        }
      },
      ...sections,
    ];

    await client.chat.postEphemeral({
      channel: command.channel_id,
      blocks,
      user: slackId,
    });
  }
  catch (error) {
    logger.error("There was an error sending the searching the bookmarks for a user", { error, command });
    await client.chat.postEphemeral({
      channel: command.channel_id,
      "text": "There was an issue fetching your bookmarks. Please try again. If the problem persists, please contact support."
    });
  }
}