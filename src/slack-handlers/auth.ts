import { AppHomeOpenedEvent, SlackAction } from "@slack/bolt";
import logger from "logger";
import { ISlackUser } from "../models/slack-user";
import database from "../services/database/database";
import internalStore, { InternalEventTypes } from "../services/internal-store";

export async function handleAppHomeOpened(event: AppHomeOpenedEvent, client: any) {
  logger.info("Handling the app_home_opened event", event);
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

      if (!user) {
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
      }


      const loginUrl = `https://app.${process.env.DOMAIN}/login?slackTeam=${team.id}&slackUser=${slackId}`;

      await client.chat.postEphemeral({
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
        channel: slackId,
        user: slackId,
        text: ``
      });
    } catch (error) {
      logger.error("There was a problem prompting a slack user to log-in", error);
    }
    return;
  }
}

export async function handleLoginButtonClick(body: SlackAction, ack: Function) {
  await ack();
  logger.info("Received a log_in_button_click action", body);
}
