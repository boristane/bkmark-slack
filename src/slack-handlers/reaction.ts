import bookmarkService, { IBookmarkCreateRequest } from "../services/bookmarks";
import logger from "logger";
import { WebClient } from "@slack/web-api"
import database from "../services/database/database";
import { IBookmarkCreateRequestSent } from "../models/internal-events";
import internalStore, { InternalEventTypes } from "../services/internal-store";
import { promisify } from "util";
import { ISlackUser } from "../models/slack-user";

const wait = promisify(setTimeout);

export async function handleReaction(urls: string[], slackId: string, channel: string, client: WebClient) {
  logger.info("Processing the emoji reaction", { urls, slackId, channel });

  const { team } = await client.team.info() as any;
  let slackUser = await database.getSlackUser(team.id, slackId);

  if (!slackUser || !slackUser.userId) {
    if (!slackUser) {
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
      channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `👋 Hi <@${slackId}>, you're not logged in to Bkmark. Please log in to start syncing the links you share on Slack in Bkmark.`
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
    return;
  }

  const collection = await database.getCollectionByChannel(team.id, channel);

  if (!collection) {
    const helpUrl = `https://help.${process.env.DOMAIN}`;
    await client.chat.postEphemeral({
      channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `👋 Hi <@${slackId}>, this channel is not linked to a Bkmark collection. Please follow the instructions below to sync all the links shared in this channel to Bkmark.`
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
      user: slackId,
    });
    return;
  }

  const failures: any[] = [];
  await Promise.all(urls.map(async url => {
    const requestData: IBookmarkCreateRequest = {
      url: url,
      userId: slackUser?.userId!,
      collectionId: collection.uuid,
      organisationId: collection.organisationId,
      origin: "SLACK",
    }

    try {
      await bookmarkService.requestBookmarkCreate(requestData);
      await wait(2);
      const e: IBookmarkCreateRequestSent = {
        uuid: `organisation#${collection.organisationId}#collection#${collection.uuid}`,
        data: { requestData },
        type: InternalEventTypes.bookmarkCreateRequestSent,
      }
      await internalStore.createInternalEvent(e);
    } catch (error) {
      logger.error("Received an error from the bookmarks service", { error, data: requestData });
      failures.push(error);
    }
  }))

  if (failures.length > 0) {
    const messageAddon = failures.some(error => error.message?.includes("402")) ? "The Slack integration is available only on the Teams Plan. " : "";
    const supportUrl = `https://help.${process.env.DOMAIN}`;
    await client.chat.postEphemeral({
      channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `👋 Hi <@${slackId}>, there was an issue syncing to Bkmark. ${messageAddon}Please contact support for further help.`
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
      user: slackId,
    });
    return;
  }

  const recentUrl = `https://app.${process.env.DOMAIN}?view=recent`;
  await client.chat.postEphemeral({
    channel,
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `👋 Hi <@${slackId}>, link(s) synced in Bkmark.`
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
    user: slackId,
  });
}
