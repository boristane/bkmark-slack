import { Callback, Context, DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { Converter } from "aws-sdk/clients/dynamodb";
import logger from "logger";
import eventBus from "./services/event-bus";

export async function fanout(event: DynamoDBStreamEvent, context: Context, callback: Callback) {

  const { Records } = event;

  try {
    await fanoutFunction(Records);
  } catch (error) {
    logger.error("Error when processing messages from the dynamo db stream.", { error });
    callback(`Error when processing messages from the dynamo db stream.`);
  }
}

async function fanoutFunction(records: DynamoDBRecord[]) {
  const entries = transformRecords(records);
  if (entries.length === 0) {
    return;
  }
  const source = "bkmark-slack-integration-service";
  await eventBus.fanoutEntries(entries, source);
}

function transformRecords(records: DynamoDBRecord[]) {
  return records
    .filter(record => record?.dynamodb?.NewImage)
    .map(d => {
      const image = d.dynamodb?.NewImage;
      if (!image) return;
      return Converter.unmarshall(image);
    }) as Record<string, any>[];
}
