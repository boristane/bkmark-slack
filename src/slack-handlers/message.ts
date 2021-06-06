import bookmarkService, { IBookmarkCreateRequest } from "../services/bookmarks";
import logger from "logger";
import { Context, SayFn, MessageEvent } from "@slack/bolt";
import { WebClient } from "@slack/web-api"
import database from "../services/database/database";
import { IBookmarkCreateRequestSent } from "../models/internal-events";
import internalStore, { InternalEventTypes } from "../services/internal-store";

export async function handleMessage(message: MessageEvent & { user?: string; team?: string }, context: Context, say: SayFn, client: WebClient) {
  logger.info("Processing the message", { context, message });
  const url = context.matches[0];

  let slackUser = await database.getSlackUser(message.team!, message.user!);
  if (!slackUser) {
    const { team } = await client.team.info() as any;
    slackUser = {
      slackId: message.user!,
      teamId: team.id,
      domain: team.domain,
    };

    await database.createSlackUser(slackUser);
    const loginUrl = `https://app.${process.env.DOMAIN}/login?slackTeam=${team.id}&slackUser=${message.user}`;
    await client.chat.postEphemeral({
      channel: message.channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `👋 Hi <@${message.user}>, you're not logged in to Bkmark. Please log in to start syncing the links you share on Slack in Bkmark.`
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
      user: message.user!,
    });
    return;
  }

  const collection = await database.getCollectionByChannel(message.team!, message.channel);

  if (!collection) {
    const helpUrl = `https://help.${process.env.DOMAIN}`;
    await client.chat.postEphemeral({
      channel: message.channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `👋 Hi <@${message.user}>, this channel is not linked to a Bkmark collection. Please follow the instructions below to sync all the links shared in this channel to Bkmark.`
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
                "text": "View Instructions",
                "emoji": true
              },
              "value": "connect_slack_instructions_click",
              "action_id": "connect_slack_instructions_click",
              "url": encodeURI(helpUrl),
            }
          ]
        }
      ],
      text: ``,
      user: message.user!,
    });
    return;
  }

  const requestData: IBookmarkCreateRequest = {
    url: url,
    userId: slackUser.userId!,
    collectionId: collection.uuid,
    organisationId: collection.organisationId,
    origin: "SLACK",
  }

  try {
    // To make sure we respond to slack within 3 seconds, we send the request and don't wait for the response (no await)
    bookmarkService.requestBookmarkCreate(requestData);
    const e: IBookmarkCreateRequestSent = {
      uuid: `organisation#${collection.organisationId}#collection#${collection.uuid}`,
      data: { requestData },
      type: InternalEventTypes.bookmarkCreateRequestSent,
    }
    await internalStore.createInternalEvent(e);
  } catch (error) {
    logger.error("Received an error from the bookmarks service", { error, data: requestData });
    const supportUrl = "https://help.bkmark.io";
    await client.chat.postEphemeral({
      channel: message.channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `👋 Hi <@${message.user}>, there was an issue syncing this link to Bkmark. Please contact support for further help.`
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
                "text": "Contact Support",
                "emoji": true
              },
              "value": "contact_support_click",
              "action_id": "contact_support_click",
              "url": encodeURI(supportUrl),
            }
          ]
        }
      ],
      text: ``,
      user: message.user!,
    });
    return;
  }

  const recentUrl = `https://app.${process.env.DOMAIN}?view=recent`;
  await client.chat.postEphemeral({
    channel: message.channel,
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `👋 Hi <@${message.user}>, this link was synced in Bkmark.`
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
              "text": "View Bookmark",
              "emoji": true
            },
            "value": "view_saved_link_click",
            "action_id": "view_saved_link_click",
            "url": encodeURI(recentUrl),
          }
        ]
      }
    ],
    text: ``,
    user: message.user!,
  });
}
