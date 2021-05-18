import logger from "logger";
import { success, handleError, IHTTPResponse, failure } from "../utils/http-responses";
import { Context, APIGatewayEvent } from "aws-lambda";
import { wrapper } from "../utils/controllers-helpers";
import database from "../services/database/database";


async function getCollectionssss(event: APIGatewayEvent): Promise<IHTTPResponse> {
  try {
    const userData = event.requestContext.authorizer;
    const { organisationId, collectionId } = event.queryStringParameters!;

    if (!organisationId || !collectionId) {
      return failure({ message: "Bad Request" }, 400);
    }

    const { uuid } = userData!;
    const user = await database.getUser(uuid);
    if (!user.collections?.some(col => col.uuid === collectionId && col.organisationId === organisationId)) {
      return failure({ message: "Forbidden" }, 403);
    }

    const collection = (await database.getCollection(organisationId, collectionId));

    const data = {
      message: "Got the collection.",
      data: {
        organisationId: organisationId,
        collection,
      },
    };

    return success(data);
  } catch (err) {
    const message = "Unexpected error when getting the collection";
    return handleError(err, event.body, message);
  }
}

export async function handler(event: APIGatewayEvent, context: Context) {
  const correlationId = event.headers["x-correlation-id"];
  return await logger.bindFunction(wrapper, correlationId)(getCollectionssss, event);
}
