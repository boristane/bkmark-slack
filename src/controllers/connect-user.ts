import logger from "logger";
import { Context, Callback, APIGatewayEvent } from "aws-lambda";
import database from "../services/database/database";
import { wrapper } from "../utils/controllers-helpers";
import { handleError, success } from "../utils/http-responses";

async function handlerFunction(event: APIGatewayEvent) {
  try {
    const body = JSON.parse(event.body!);
    const userData = event.requestContext.authorizer!;
    const { uuid } = userData;
    const { slackId, teamId, organisationId } = body;

    await database.connectUserToSlackUser(teamId, slackId, uuid);

    const data = {
      message: "Slack user connected",
      data: {
        slackId,
      },
    };
    return success(data, 200);
  } catch (err) {
    const message = "Unexpected error when handling a connect user to slack user request";
    return handleError(err, event.body, message);
  }
}

export async function handler(event: any, context: Context, callback: Callback) {
  const correlationId = event.headers["x-correlation-id"];
  return logger.bindFunction(wrapper, correlationId)(handlerFunction, event);
}
