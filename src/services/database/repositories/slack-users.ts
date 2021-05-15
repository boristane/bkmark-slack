import { ISlackUser } from "../../../models/slack-user";
import { IDatabaseItem, initialise } from "../init";
import logger from "logger";
import moment from "dayjs";

async function createSlackUser(slackUser: ISlackUser): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  slackUser.created = moment().format();
  slackUser.updated = moment().format();

  const dbUser: IDatabaseItem = {
    partitionKey: `slack-team#${slackUser.teamId}`,
    sortKey: `slack-user#${slackUser.slackId}`,
    gsi1PartitionKey: `slack-team#${slackUser.domain || 'no-domain'}`,
    gsi1SortKey: `slack-user#${slackUser.slackId}`,
    data: slackUser,
    created: slackUser.created,
    updated: slackUser.updated,
    type: "slack-user",
  };
  const params = {
    TableName: tableName,
    Item: dbUser,
    ConditionExpression: "attribute_not_exists(partitionKey)",
  };

  try {
    await dynamoDb.put(params).promise();
  } catch (e) {
    const message = "Failed to save a slack user in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

async function getSlackUser(teamId: string, slackId: string): Promise<ISlackUser | undefined> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `slack-team#${teamId}`,
      sortKey: `slack-user#${slackId}`,
    },
  };
  try {
    const record = await dynamoDb.get(params).promise();
    if (!record.Item) {
      return;
    }
    return record.Item as ISlackUser;
  } catch (e) {
    logger.error("Error getting the slack user", { params, error: e });
  }
}

async function connectUserToSlackUser(teamId: string, slackId: string, uuid: string) {
  const { tableName, dynamoDb } = initialise();

  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `slack-team#${teamId}`,
      sortKey: `slack-user#${slackId}`,
    },

    UpdateExpression: "SET #d.#userId = :userId, #d.updated = :updated, updated = :updated, #gsi2PartitionKey = :gsi2PartitionKey, #gsi2SortKey = :gsi2SortKey",
    ExpressionAttributeNames: {
      "#d": "data",
      "#userId": "userId",
      "#gsi2PartitionKey": "gsi2PartitionKey",
      "#gsi2SortKey": "gsi2SortKey",
    },
    ExpressionAttributeValues: {
      ":userId": uuid,
      ":updated": moment().format(),
      ":gsi2PartitionKey": `user#${uuid}`,
      ":gsi2SortKey": `user#${uuid}`,
    },
    ReturnValues: "ALL_NEW",
  };
  try {
    await dynamoDb.update(params).promise();
  } catch (e) {
    logger.error("There was an error setting the user slackId", { params, error: e });
    throw e;
  }
}

export default {
  getSlackUser,
  createSlackUser,
  connectUserToSlackUser,
}
