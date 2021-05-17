import { App, AwsLambdaReceiver, ExpressReceiver, Installation, InstallationQuery } from '@slack/bolt';
import { handleAppHomeOpened, handleLoginButtonClick } from './slack-handlers/auth';
import database from './services/database/database';
import internalStore, { InternalEventTypes } from './services/internal-store';
import { ISlackInstallationCreated } from './models/internal-events';
import { handleMessage } from './slack-handlers/message';
import { handleUninstallApp } from './slack-handlers/uninstall';
import logger from "logger";

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
    "channels:history",
    "chat:write",
    "groups:history",
    "im:history",
    "mpim:history",
    "team:read",
    "links:read",
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
const regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

slackApp.message(regex, async ({ message, context, say, client }) => {
  await handleMessage(message, context, say, client);
});

slackApp.event<'app_home_opened'>('app_home_opened', async ({ event, client, say }) => {
  await handleAppHomeOpened(event, client, say);
});

slackApp.action('log_in_button_click', async ({ body, ack, say }) => {
  await handleLoginButtonClick(body, ack, say);
});

slackApp.event<'app_uninstalled'>('app_uninstalled', async ({ event }) => {
  await handleUninstallApp(event);
});

module.exports.eventHandler = eventReceiver.toHandler();
