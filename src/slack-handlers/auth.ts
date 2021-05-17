import { AppHomeOpenedEvent, SayFn, SlackAction } from "@slack/bolt";
import logger from "logger";
import { ISlackTeam } from "../models/slack-team";
import { ISlackUser } from "../models/slack-user";
import database from "../services/database/database";
import internalStore, { InternalEventTypes } from "../services/internal-store";

export async function handleAppHomeOpened(event: AppHomeOpenedEvent, client: any, say: SayFn) {
  const { user: slackId } = event;

  const { team } = await client.team.info();
  const user = await database.getSlackUser(team.id, slackId);

  if (!user) {
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
      await internalStore.createInternalEvent(e);

      await say({
        blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `👋 Hi, <@${slackId}> you're not logged in to Bkmark. Please log in to start syncing the links you share on Slack in Bkmark.`
            },
            "accessory": {
              "type": "image",
              "image_url": "https://d1apvrodb6vxub.cloudfront.net/og-image.png",
              "alt_text": "alt text for image"
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
                "url": `http://localhost:8080/integrations/connect-slack?team=${team.id}&name=${team.name}&id=${slackId}`
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

  // TODO what to do when the user is logged in
  try {
    const result = await client.views.publish({
      user_id: slackId,
      view: {
        "type": "home",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Welcome home, <@" + slackId + "> :house:*"
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Learn how home tabs can be more useful and interactive <https://api.slack.com/surfaces/tabs/using|*in the documentation*>."
            }
          }
        ]
      }
    });

    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
}

export async function handleLoginButtonClick(body: SlackAction, ack: Function, say: SayFn) {
  await ack();
  logger.info("Received a log_in_button_click action", body);
}
