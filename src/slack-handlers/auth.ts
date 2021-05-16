import { AppHomeOpenedEvent, SayFn, SlackAction } from "@slack/bolt";
import logger from "logger";
import { ISlackUser } from "../models/slack-user";
import database from "../services/database/database";

export async function handleAppHomeOpened(event: AppHomeOpenedEvent, client: any, say: SayFn) {
  const { user: slackId } = event;

  const { team } = await client.team.info();
  const user = await database.getSlackUser(team.id, slackId);

  if (!user) {
    try {
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
    }
    catch (error) {
      logger.error("There was a problem prompting a slack user to log-in", error);
    }
    return;
  }

  // TODO what to do when the user is logged in
  await say(`You're logged in ma boi <@${slackId}>`);
}

export async function handleLoginButtonClick( body: SlackAction, ack: Function, say: SayFn) {
  await ack();
  logger.info("Received a log_in_button_click action", body);
  try {

    if (!body.team?.id) {
      throw new Error("Received a log_in_button_click event with no team attached. This needs immediate attention");
    }
    const slackUser: ISlackUser = {
      slackId: body.user.id,
      teamId: body.team?.id,
      domain: body.team?.domain,
    };

    await database.createSlackUser(slackUser);
    await say(`<@${body.user.id}> saved you in the database`);
  } catch (error) {
    logger.error("There was an error processingt the app_home_opened", { error, body });
  }
}
