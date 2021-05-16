import { initialiseDb } from "../utils/db-helpers";
import { DynamoDB } from "aws-sdk";
import moment from "dayjs";
import logger from "logger";
import { IInternalEvent } from "../models/internal-events";

function initialise() : { tableName: string, dynamoDb: DynamoDB.DocumentClient }  {
  const tableName = process.env.INTERNAL_EVENTS_TABLE!;
  return initialiseDb(tableName);
}

async function createInternalEvent(data: Record<string, any>): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  if (!data.uuid) {
    throw new Error("The uuid is missing from the event data");
  }

  const record: IInternalEvent = {
    uuid: (data.uuid).toString(),
    data: { ...data, correlationId: logger.getCorrelationId() },
    timestamp: moment().valueOf(),
    type: data.type,
    correlationId: logger.getCorrelationId(),
  }

  const params = {
    TableName: tableName,
    Item: record,
    ConditionExpression: "attribute_not_exists(#uuid)",
    ExpressionAttributeNames: {
      "#uuid": "uuid"
    },
  };

  try {
    await dynamoDb.put(params).promise();
  } catch (e) {
    const message = "Failed to save internal event in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

export enum InternalEventTypes {
  slackInstallationCreated = "SLACK_INSTALLATION_CREATED",
}

export default {
  createInternalEvent,
}
