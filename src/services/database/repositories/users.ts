import { IDatabaseItem, initialise } from "../init";
import moment from "dayjs";
import logger from "logger";
import { IUser } from "../../../models/user";

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

async function editUser(uuid: string, forename: string, surname: string): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `user#${uuid}`,
      sortKey: `user#${uuid}`,
    },
    UpdateExpression: `SET #data.#forename = :forename, #data.#surname = :surname, #data.updated = :updated, updated = :updated`,
    ExpressionAttributeNames: {
      "#forename": "forename",
      "#surname": "surname",
      "#data": "data",
    },
    ExpressionAttributeValues: {
      ":forename": forename,
      ":surname": surname,
      ":updated": moment().format(),
    },
    ReturnValues: "ALL_NEW",
  };
  try {
    return (await dynamoDb.update(params).promise()).Attributes?.data;
  } catch (e) {
    logger.error("Failed to edit a user in dynamo db", { params, error: e });
    throw e;
  }
}

async function deleteUser(userId: string): Promise<void> {
  const { tableName, dynamoDb } = initialise();

  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `user#${userId}`,
      sortKey: `user#${userId}`,
    },
  };

  try {
    await dynamoDb.delete(params).promise();
  } catch (e) {
    const message = "Failed to delete user from dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

async function appendOrganisationToUser(userId: string, organisationId: string): Promise<IUser> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `user#${userId}`,
      sortKey: `user#${userId}`,
    },
    UpdateExpression: `set #data.#organisations = list_append(if_not_exists(#data.#organisations, :emptyArray), :organisationId), #data.updated = :updated, updated = :updated`,
    ExpressionAttributeNames: {
      "#data": "data",
      "#organisations": "organisations",
    },
    ExpressionAttributeValues: {
      ":updated": moment().format(),
      ":emptyArray": [],
      ":organisationId": [organisationId],
    },
    ReturnValues: "ALL_NEW",
  };
  try {
    return (await dynamoDb.update(params).promise()).Attributes?.data;
  } catch (e) {
    const message = "Failed to append an organisations to a user in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

async function appendCollectionToUser(
  userId: string,
  organisationId: string,
  collectionId: string,
): Promise<IUser> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `user#${userId}`,
      sortKey: `user#${userId}`,
    },
    UpdateExpression: `set #data.#collections = list_append(if_not_exists(#data.#collections, :emptyArray), :collection), #data.updated = :updated, updated = :updated`,
    ExpressionAttributeNames: {
      "#data": "data",
      "#collections": "collections",
    },
    ExpressionAttributeValues: {
      ":updated": moment().format(),
      ":emptyArray": [],
      ":collection": [{ uuid: collectionId, organisationId }],
    },
    ReturnValues: "ALL_NEW",
  };
  try {
    return (await dynamoDb.update(params).promise()).Attributes?.data;
  } catch (e) {
    const message = "Failed to append a collection to a user in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

async function removeCollectionFromUser(
  userId: string,
  index: number,
): Promise<IUser> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `user#${userId}`,
      sortKey: `user#${userId}`,
    },
    UpdateExpression: `remove #data.#collections[${index}] set #data.updated = :updated, updated = :updated`,
    ExpressionAttributeNames: {
      "#data": "data",
      "#collections": "collections",
    },
    ExpressionAttributeValues: {
      ":updated": moment().format(),
    },
    ReturnValues: "ALL_NEW",
  };
  try {
    return (await dynamoDb.update(params).promise()).Attributes?.data;
  } catch (e) {
    const message = "Failed to remove a collection to a user in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}



export default {
  createUser,
  getUser,
  deleteUser,
  editUser,
  appendOrganisationToUser,
  appendCollectionToUser,
  removeCollectionFromUser,
}
