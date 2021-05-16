import bookmarkService, { IBookmarkCreateRequest } from "../services/bookmarks";
import logger from "logger";
import { Context, SayFn, MessageEvent } from "@slack/bolt";
import { WebClient } from "@slack/web-api"
import database from "../services/database/database";

export async function handleMessage(message: MessageEvent, context: Context, say: SayFn, client: WebClient) {
  logger.info("Processing the message", { context, message });
  const url = context.matches[0];

  //@ts-ignore
  const slackUser = await database.getSlackUser(message.team, message.user);
  if (!slackUser) {
    // TODO add blocks here to ask the user to login
    await client.chat.postEphemeral({
      channel: message.channel,
      text: "We could not find a slack user",
      //@ts-ignore
      user: message.user,
    });
    return;
  }

  //@ts-ignore
  const collection = await database.getCollectionByChannel(message.team, message.channel);

  if (!collection) {
    // TODO add blocks here to ask the user to connect the slack channel to Bkmark
    await client.chat.postEphemeral({
      channel: message.channel,
      text: "We could not find the collection",
      //@ts-ignore
      user: message.user,
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
    await bookmarkService.requestBookmarkCreate(requestData);
  } catch (error) {
    logger.error("Received an error from the bookmarks service", { error, data: requestData });
  }

  await say(`Here's the url ${url}`);
}