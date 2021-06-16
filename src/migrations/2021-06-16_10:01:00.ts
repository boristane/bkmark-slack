import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { initialiseDb } from "../utils/db-helpers";
import logger from "logger";
import database from "../services/database/database";

process.env.ENV = "offline";
process.env.REGION = "eu-west-2";
process.env.PROJECTION_TABLE = "bkmark-slack-integration-projection";

interface IUser {
  uuid: string;
  organisations: string[];
  forename: string;
  surname: string;
  collections: Array<{ ownerId: string; uuid: string, isOrganisation: boolean }>;
}

function initialiseSearch(): { tableName: string; dynamoDb: DocumentClient } {
  const tableName = "bkmark-search-projection-2";
  return initialiseDb(tableName);
}

async function getAllExistingUsersFromSearch(): Promise<IUser[]> {
  const { tableName, dynamoDb } = initialiseSearch();
  let lastEvaluatedKey: DocumentClient.Key | undefined = undefined;
  let users: IUser[] = [];
  do {
    const params: DocumentClient.QueryInput = {
      TableName: tableName,
      IndexName: "type",
      KeyConditionExpression: "#pk = :pkey",
      ProjectionExpression: "#d",
      ExpressionAttributeValues: {
        ":pkey": `user`,
      },
      ExpressionAttributeNames: {
        "#d": "data",
        "#pk": "type",
      },
      ExclusiveStartKey: lastEvaluatedKey,
    };
    try {
      const records = await dynamoDb.query(params).promise();
      const result = records.Items?.map((item) => item.data) as IUser[];
      users = [...users, ...result];
      lastEvaluatedKey = records.LastEvaluatedKey;
    } catch (e) {
      logger.error("Error getting the users from search", { params, error: e });
      throw e;
    }
  } while (lastEvaluatedKey !== undefined);
  return users;
}

async function seed() {
  const searchUsers = await getAllExistingUsersFromSearch();


  await Promise.all(searchUsers.map(async user => {
    if (user.uuid === "197ceed9-37cc-4cf8-8462-7cfab112c953") return;
    await Promise.all(user.collections.map(async collection => {
      logger.info("Desling with collection", collection)
      await database.appendCollectionToUser(user.uuid, collection.ownerId, collection.uuid);
    }))
  }));
}

seed();
