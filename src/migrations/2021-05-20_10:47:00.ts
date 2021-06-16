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

interface ICollection {
  uuid: string;
  organisationId: string;
}

function initialiseUsers(): { tableName: string; dynamoDb: DocumentClient } {
  const tableName = "bkmark-users-projection";
  return initialiseDb(tableName);
}

function initialiseSearch(): { tableName: string; dynamoDb: DocumentClient } {
  const tableName = "bkmark-search-projection";
  return initialiseDb(tableName);
}

function initialiseBookmark(): { tableName: string; dynamoDb: DocumentClient } {
  const tableName = "bkmark-bookmarks-projection";
  return initialiseDb(tableName);
}

async function getAllExistingCollections() {
  const { tableName, dynamoDb } = initialiseBookmark();
  let lastEvaluatedKey: DocumentClient.Key | undefined = undefined;
  let users: ICollection[] = [];
  do {
    const params: DocumentClient.QueryInput = {
      TableName: tableName,
      IndexName: "type",
      KeyConditionExpression: "#pk = :pkey",
      ProjectionExpression: "#d",
      ExpressionAttributeValues: {
        ":pkey": `collection`,
      },
      ExpressionAttributeNames: {
        "#d": "data",
        "#pk": "type",
      },
      ExclusiveStartKey: lastEvaluatedKey,
    };
    try {
      const records = await dynamoDb.query(params).promise();
      const result = records.Items?.map((item) => item.data) as ICollection[];
      users = [...users, ...result];
      lastEvaluatedKey = records.LastEvaluatedKey;
    } catch (e) {
      logger.error("Error getting the collections", { params, error: e });
      throw e;
    }
  } while (lastEvaluatedKey !== undefined);
  return users;
}

async function getAllExistingUsers(): Promise<IUser[]> {
  const { tableName, dynamoDb } = initialiseUsers();
  let lastEvaluatedKey: DocumentClient.Key | undefined = undefined;
  let users: IUser[] = [];
  do {
    const params = {
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    try {
      const records: DocumentClient.ScanOutput = await dynamoDb.scan(params).promise();
      if (!records.Items) {
        return [];
      }
      const result = records.Items as IUser[];
      users = [...users, ...result];
      lastEvaluatedKey = records.LastEvaluatedKey;
    } catch (error) {
      logger.error("There was a problem getting all the user from dynamoDB", {
        error,
      });
      throw error;
    }
  } while (lastEvaluatedKey !== undefined);
  return users;
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
  const collections = await getAllExistingCollections();
  const users = await getAllExistingUsers();
  const searchUsers = await getAllExistingUsersFromSearch();

  const collectionsPromises = collections.map(async col => {
    logger.info("Processing the collection", { uuid: col.uuid });
    await database.createCollection(col);
  });

  const usersPromises = users.map(async user => {
    logger.info("Processing the user", { uuid: user.uuid });
    const searchUser = searchUsers.find(u => u.uuid === user.uuid);
    const u = {
      uuid: user.uuid,
      organisations: user.organisations,
      forename: user.forename,
      surname: user.surname,
      collections: searchUser?.collections.map(c => { return { uuid: c.uuid, organisationId: c.ownerId } }) || [],
    }
    await database.createUser(u);
  });

  await Promise.all(collectionsPromises);
  await Promise.all(usersPromises);
}

seed();
