import { IDatabaseItem, initialise } from "../init";
import moment from "dayjs";
import logger from "logger";
import { IUser } from "../../../models/user";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

async function createUser(user: IUser): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  user.created = moment().format();
  user.updated = moment().format();

  const dbUser: IDatabaseItem = {
    partitionKey: `user#${user.uuid}`,
    sortKey: `user#${user.uuid}`,
    data: user,
    created: user.created,
    updated: user.updated,
    type: "user",
  };
  const params = {
    TableName: tableName,
    Item: dbUser,
    ConditionExpression: "attribute_not_exists(partitionKey)",
  };

  try {
    await dynamoDb.put(params).promise();
  } catch (e) {
    const message = "Failed to save user in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

export async function getUser(userId: string): Promise<IUser> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `user#${userId}`,
      sortKey: `user#${userId}`,
    },
    ProjectionExpression: "#d",
    ExpressionAttributeNames: {
      "#d": "data",
    },
  };
  try {
    const record = await dynamoDb.get(params).promise();
    if (record.Item) {
      return record.Item.data as IUser;
    } else {
      throw new Error("User not found");
    }
  } catch (e) {
    logger.error("Error getting the user", { params, error: e });
    throw e;
  }
}



export default {
  createUser,
  getUser,
}
