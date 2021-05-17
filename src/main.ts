import { Callback, Context, DynamoDBRecord, DynamoDBStreamEvent, SQSEvent, SQSRecord } from "aws-lambda";
import { Converter } from "aws-sdk/clients/dynamodb";
import logger from "logger";
import { handleMessage } from "./handlers/handlers";
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

async function commandFunction(record: SQSRecord): Promise<{ result: boolean, record: SQSRecord }> {
  let message = JSON.parse(record.body || "");
  if (message.Message) { message = JSON.parse(message.Message); }
  let correlationId: string = message.correlationId;
  const res = await logger.bindFunction(handleMessage, correlationId)(message);
  return { result: res, record };
}

export async function command(event: SQSEvent, context: Context, callback: Callback) {
  const { Records } = event;

  const promises = Records.map((record) => commandFunction(record));
  const results = await Promise.all(promises);
  const failures = results.filter(r => !r.result);

  if (failures.length > 0) {
    logger.error("Error when processing messages from queue.", { failures });
    callback(`Error when processing messages from queue.`);
  }
}
