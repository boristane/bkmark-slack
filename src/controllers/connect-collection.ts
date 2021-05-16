import logger from "logger";
import { Context, Callback, APIGatewayEvent } from "aws-lambda";
import database from "../services/database/database";
import { wrapper } from "../utils/controllers-helpers";
import { failure, handleError, success } from "../utils/http-responses";
import { App } from "@slack/bolt";

const slackApp = new App({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
});

async function handlerFunction(event: APIGatewayEvent) {
  try {
    const body = JSON.parse(event.body!);
    const userData = event.requestContext.authorizer!;
    const { uuid } = userData;
    const { organisationId, collectionId, domain, channelId } = body;

    const user = await database.getUser(uuid);
    if (!user.collections.some(col => col.uuid === collectionId && col.organisationId === organisationId)) {
      return failure({ message: "Forbidden" }, 403);
    }

    const { team } = await slackApp.client.team.info() as any;

    await database.connectChannelToConnection(organisationId, collectionId, team.id as string, domain, channelId);

    const data = {
      message: "Channel connected",
      data: {
        organisationId,
        collectionId,
      },
    };
    return success(data, 200);
  } catch (err) {
    const message = "Unexpected error when handling a connect slack channel to collection";
    return handleError(err, event.body, message);
  }
}

export async function handler(event: any, context: Context, callback: Callback) {
  const correlationId = event.headers["x-correlation-id"];
  return logger.bindFunction(wrapper, correlationId)(handlerFunction, event);
}
