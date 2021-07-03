import { App, AwsLambdaReceiver, ExpressReceiver, Installation, InstallationQuery } from '@slack/bolt';
import { handleAppHomeOpened, handleLoginButtonClick } from './slack-handlers/auth';
import database from './services/database/database';
import internalStore, { InternalEventTypes } from './services/internal-store';
import { ISlackInstallationCreated } from './models/internal-events';
import { handleUninstallApp } from './slack-handlers/uninstall';
import logger from "logger";
import { handleSearch } from './slack-handlers/search';
import bookmarks from './services/bookmarks';
import { handleReaction } from './slack-handlers/reaction';
import { AwsCallback, AwsEvent } from '@slack/bolt/dist/receivers/AwsLambdaReceiver';
import { findObject } from './utils/utils';

const installationStore = {
  storeInstallation: async (installation: Installation) => {
    if (installation.isEnterpriseInstall) {
      await database.createSlackInstallation(installation.enterprise?.id!, installation);
    } else {
      await database.createSlackInstallation(installation.team?.id!, installation);
    }
    const event: ISlackInstallationCreated = {
      uuid: installation.enterprise?.id || installation.team?.id!,
      data: { installation },
      type: InternalEventTypes.slackInstallationCreated,
    }
    await internalStore.createInternalEvent(event);
  },
  fetchInstallation: async (installQuery: InstallationQuery<boolean>) => {
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      return await database.getSlackInstallation(installQuery.enterpriseId);
    }
    if (installQuery.teamId !== undefined) {
      return await database.getSlackInstallation(installQuery.teamId);
    }
    logger.error("There was an error fetching the installation", { installQuery });
    throw new Error('Failed fetching installation');
  },
};


const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET,
  scopes: [
    "app_mentions:read",
    "reactions:read",
    "chat:write",
    "team:read",
    "links:read",
    "commands",
    "channels:history",
    "groups:history",
    "mpim:history",
    "im:history",
  ],
  installationStore,
  processBeforeResponse: true
});

const awsServerlessExpress = require('aws-serverless-express');
const server = awsServerlessExpress.createServer(expressReceiver.app);
module.exports.oauthHandler = (event: any, context: any) => {
  awsServerlessExpress.proxy(server, event, context);
}

// Slack Event Handler
const eventReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

export const slackApp = new App({
  receiver: eventReceiver,
  authorize: async (source) => {
    try {
      const queryResult = await installationStore.fetchInstallation(source);
      if (queryResult === undefined) {
        throw new Error('Failed fetching data from the Installation Store');
      }

      const authorizeResult: Record<string, any> = {};
      authorizeResult.userToken = queryResult.user.token;
      if (queryResult.team !== undefined) {
        authorizeResult.teamId = queryResult.team.id;
      } else if (source.teamId !== undefined) {
        authorizeResult.teamId = source.teamId;
      }
      if (queryResult.enterprise !== undefined) {
        authorizeResult.enterpriseId = queryResult.enterprise.id;
      } else if (source.enterpriseId !== undefined) {
        authorizeResult.enterpriseId = source.enterpriseId;
      }
      if (queryResult.bot !== undefined) {
        authorizeResult.botToken = queryResult.bot.token;
        authorizeResult.botId = queryResult.bot.id;
        authorizeResult.botUserId = queryResult.bot.userId;
      }
      return authorizeResult;
    } catch (error) {
      logger.error("There was an error autorizing a slack event listener action", { source, error });
      throw error;
    }
  },
  processBeforeResponse: true
});

// From https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
// const regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

// slackApp.message(regex, async ({ message, context, say, client }) => {
//   await handleMessage(message, context, say, client);
// });

slackApp.event<'app_home_opened'>('app_home_opened', async ({ event, client }) => {
  try {
    await handleAppHomeOpened(event, client);
  } catch (error) {
    logger.error("There was an issue handling the app_home_opened event", { event, error });
  }
});


slackApp.event<'reaction_added'>('reaction_added', async ({ event, client, context }) => {
  try {
    logger.info("Processing reaction_added event", event);
    if (event.reaction !== "bookmark") {
      return;
    }
    const { item } = event;
    if (item.type !== "message") {
      return;
    }

    const r = (await client.reactions.get({ timestamp: item.ts, full: true, channel: item.channel }));
    //@ts-ignore
    const existingReactions = r.message?.reactions as Array<Record<string, any>>

    const bookmarkReactions = existingReactions.find(reaction => reaction.name === "bookmark");
    if (bookmarkReactions?.count > 1) {
      return;
    }

    const result = (await client.conversations.history({ channel: item.channel, latest: item.ts, limit: 1, inclusive: true }));
    //@ts-ignore
    const message = result.messages[0];

    logger.info("Here is the message", message);

    const matches = findObject(message.blocks!, "type", "link").map(a => a.url);
    logger.info("Here are the matches", matches);
    if (!matches || !matches.length) {
      return;
    }

    await handleReaction(matches, event.user, item.channel, client);
  } catch (error) {
    logger.error("There was an issue handling the reaction_added event", { event, error });
  }
});


slackApp.command('/bkmark', async ({ command, ack, say, client }) => {
  try {
    await ack();
    await handleSearch(command, client);
  } catch (error) {
    logger.error("There was an issue handling the /bkmark command", { command, error });
  }
});

slackApp.action('log_in_button_click', async ({ body, ack, respond }) => {
  try {
    await handleLoginButtonClick(body, ack);
    await respond({ delete_original: true });
  } catch (error) {
    logger.error("There was an issue handling the log_in_button_click action", { body, error });
  }
});

slackApp.action('connect_slack_instructions_click', async ({ body, ack, respond, action }) => {
  try {
    await ack();
    logger.info("Received a connect_slack_instructions_click action", body);
    await respond({ delete_original: true });
  } catch (error) {
    logger.error("There was an issue handling the connect_slack_instructions_click action", { body, error });
  }
});

slackApp.action('contact_support_click', async ({ body, ack, respond, action }) => {
  try {
    await ack();
    logger.info("Received a contact_support_click action", body);
    await respond({ delete_original: true });
  } catch (error) {
    logger.error("There was an issue handling the contact_support_click action", { body, error });
  }
});

slackApp.action('view_saved_link_click', async ({ body, ack, respond, action }) => {
  try {
    await ack();
    logger.info("Received a view_saved_link_click action", body);
    await respond({ delete_original: true });
  } catch (error) {
    logger.error("There was an issue handling the view_saved_link_click action", { body, error });
  }
});

slackApp.action('send_bookmark', async ({ body, ack, respond, say, action }) => {
  try {
    await ack();
    logger.info("Received a send_bookmark action", { body, action });
    await respond({ delete_original: true });
    //@ts-ignore
    const [collectionId, uuid] = action.value.split("#");
    const bookmark = await bookmarks.getBookmark({ collectionId, uuid: Number(uuid) });
    const blocks = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": ` <${bookmark.url}|*${bookmark.title || bookmark.metadata.title}*>\n${bookmark.notes || bookmark.metadata.description}`
        },
        "accessory": {
          "type": "image",
          "image_url": bookmark.metadata.image,
          "alt_text": bookmark.title || bookmark.metadata.title || "",
        }
      }
    ];
    await say({
      //@ts-ignore
      channel: body.container.channel_id,
      //@ts-ignore
      blocks,
      text: "",
      as_user: true,
    })
  } catch (error) {
    logger.error("There was an issue handling the send_bookmark action", { body, error });
  }

});

slackApp.action('open_bookmark', async ({ body, ack, respond, action }) => {
  try {
    await ack();
    logger.info("Received a open_bookmark action", body);
    await respond({ delete_original: true });
  } catch (error) {
    logger.error("There was an issue handling the open_bookmark action", { body, error });
  }
});

slackApp.action('view_inbox_click', async ({ body, ack, respond, action }) => {
  try {
    await ack();
    logger.info("Received a view_inbox_click action", body);
    await respond({ delete_original: true });
  } catch (error) {
    logger.error("There was an issue handling the view_inbox_click action", { body, error });
  }
});

slackApp.event<'app_uninstalled'>('app_uninstalled', async ({ event }) => {
  try {
    await handleUninstallApp(event);
  } catch (error) {
    logger.error("There was an issue handling the app_uninstalled event", { event, error });
  }

});


export async function handler(event: AwsEvent, context: any, callback: AwsCallback) {
  const shouldIgnore = event.headers["X-Slack-Retry-Reason"] === "http_timeout" || Number(event.headers["X-Slack-Retry-Num"]) > 0;
  if (shouldIgnore) {
    logger.info("Ignoring because it's a retry", { headers: event.headers });
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "X-Slack-No-Retry": 1
      },
    };;
  }
  const eventHandler = eventReceiver.toHandler();
  return eventHandler(event, context, callback)
}

module.exports.handler = handler;
