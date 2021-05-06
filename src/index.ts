import { App, ExpressReceiver } from '@slack/bolt';
const serverlessExpress = require('@vendia/serverless-express');

const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  processBeforeResponse: true
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver
});

app.message('hello', async ({ message, say }) => {
  await say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          //@ts-ignore
          "text": `Hey there <@${message.user}>!`
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Click Me"
          },
          "action_id": "button_click"
        }
      }
    ],
    //@ts-ignore
    text: `Hey there <@${message.user}>!`
  });
});

app.event<'app_home_opened'>('app_home_opened', async ({ event, say }) => {
  say(`Hello world, <@${event.user}>!`);
});

app.action('button_click', async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  await say(`<@${body.user.id}> clicked the button`);
});

module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});