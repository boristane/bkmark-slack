import { Installation } from "@slack/oauth";
import { IDatabaseItem, initialise } from "../init";
import logger from "logger";
import moment from "dayjs";

async function createSlackInstallation(id: string, slackInstallation: Installation): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  const created = moment().format();
  const updated = created;

  const dbUser: IDatabaseItem = {
    partitionKey: `slack-installation#${id}`,
    sortKey: `slack-installation#${id}`,
    data: slackInstallation,
    created: created,
    updated: updated,
    type: "slack-installation",
  };
  const params = {
    TableName: tableName,
    Item: dbUser,
  };

  try {
    await dynamoDb.put(params).promise();
  } catch (e) {
    const message = "Failed to save a slack installation in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

async function getSlackInstallation(id: string): Promise<Installation> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `slack-installation#${id}`,
      sortKey: `slack-installation#${id}`,
    },
    ProjectionExpression: "#d",
    ExpressionAttributeNames: {
      "#d": "data",
    },
  };
  try {
    const record = await dynamoDb.get(params).promise();
    if (!record.Item) {
      throw new Error("No slack installation found");
    }
    return record.Item.data as Installation;
  } catch (e) {
    logger.error("Error getting the slack installation", { params, error: e });
    throw e;
  }
}

export default {
  createSlackInstallation,
  getSlackInstallation,
}
