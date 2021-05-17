import logger from "logger";
import { Context, Callback, APIGatewayEvent } from "aws-lambda";
import database from "../services/database/database";
import { wrapper } from "../utils/controllers-helpers";
import { failure, handleError, success } from "../utils/http-responses";


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

    const team = await database.getSlackTeamByDomain(domain);
    if(!team) {
      logger.error("User is trying to connect a collection to a slack team which doesn't exist yet");
      return failure({ message: "Forbidden" }, 403);
    }

    await database.connectChannelToCollection(organisationId, collectionId, team.id, domain, channelId);

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
