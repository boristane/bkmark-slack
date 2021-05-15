import { App, ExpressReceiver } from '@slack/bolt';
import { handleAppHomeOpened } from './slack-handlers/auth';
const serverlessExpress = require('@vendia/serverless-express');
import logger from "logger";
import database from './services/database/database';
import { ISlackUser } from './models/slack-user';

const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  processBeforeResponse: true
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver
});

// From https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
const regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

app.message(regex, async ({ context, say }) => {
  // RegExp matches are inside of context.matches
  const url = context.matches[0];

  await say(`Here's the url ${url}`);
});

app.event<'app_home_opened'>('app_home_opened', async ({ event, client, say }) => {
  logger.info("Received a app_home_opened event", event);
  await handleAppHomeOpened(event, client, say);
});

app.action('log_in_button_click', async ({ body, ack, say }) => {
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
});

module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});