import database from "../services/database/database";
import logger from "logger";
import { WebClient } from "@slack/web-api";

export async function notifyMentionnedInABookmark(data: Record<string, any>): Promise<boolean> {
  logger.info("Handling the bookmark notification event", data);
  const { notification, bookmark } = data;
  const slackUser = await database.getSlackUserByUserId(bookmark.userId);
  if (!slackUser) {
    return true;
  }
  const installation = await database.getSlackInstallation(slackUser.teamId);

  const { slackId } = slackUser;

  const client = new WebClient(installation.bot?.token);
  const inboxUrl = `https://app.${process.env.DOMAIN}/?view=inbox`;
  await client.chat.postEphemeral({
    channel: slackId,
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `👋 Hi <@${slackId}>, you were mentioned in a bookmark.`
        },
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
              "text": "Inbox",
              "emoji": true
            },
            "value": "view_inbox_click",
            "action_id": "view_inbox_click",
            "url": encodeURI(inboxUrl),
          }
        ]
      }
    ],
    text: ``,
    user: slackId,
  });
  return true;
}