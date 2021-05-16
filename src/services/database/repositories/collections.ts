import { IDatabaseItem, initialise } from "../init";
import moment from "dayjs";
import logger from "logger";
import { ICollection } from "../../../models/collection";

async function createCollection(collection: ICollection): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  collection.created = moment().format();
  collection.updated = moment().format();

  const dbUser: IDatabaseItem = {
    partitionKey: `organisation#${collection.organisationId}`,
    sortKey: `collection#${collection.uuid}`,
    data: collection,
    created: collection.created,
    updated: collection.updated,
    type: "collection",
  };
  const params = {
    TableName: tableName,
    Item: dbUser,
    ConditionExpression: "attribute_not_exists(partitionKey)",
  };

  try {
    await dynamoDb.put(params).promise();
  } catch (e) {
    const message = "Failed to save collection in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

export async function getCollection(organisationId: string, uuid: string): Promise<ICollection> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `organisation#${organisationId}`,
      sortKey: `collection#${uuid}`,
    },
    ProjectionExpression: "#d",
    ExpressionAttributeNames: {
      "#d": "data",
    },
  };
  try {
    const record = await dynamoDb.get(params).promise();
    if (record.Item) {
      return record.Item.data as ICollection;
    } else {
      throw new Error("Collection not found");
    }
  } catch (e) {
    logger.error("Error getting the user", { params, error: e });
    throw e;
  }
}

async function getCollectionByChannel(teamId: string, channelId: string): Promise<ICollection | undefined> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    IndexName: "gsi3",
    KeyConditionExpression: "#gsi1PartitionKey = :gsi1PartitionKey AND #gsi1SortKey = :gsi1SortKey",
    ExpressionAttributeNames: {
      "#gsi1PartitionKey": "gsi1PartitionKey",
      "#gsi1SortKey": "gsi1SortKey",
      "#d": "data",
    },
    ExpressionAttributeValues: {
      ":gsi1PartitionKey": `team#${teamId}`,
      ":gsi1SortKey": `channel#${channelId}`,
    },
    ProjectionExpression: "#d",
    ScanIndexForward: false,
    Limit: 1,
  };

  try {
    const records = await dynamoDb.query(params).promise();
    if (records.Items) {
      const [collection] = records.Items.map((item) => item.data) as ICollection[];
      return collection;
    } else {
      throw new Error("Collection not found");
    }
  } catch (e) {
    logger.error("Error getting the collection by username and uuid", { params, error: e });
  }
}

async function deleteCollection(organisationId: string, collectionId: string): Promise<void> {
  const { tableName, dynamoDb } = initialise();

  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `organisation#${organisationId}`,
      sortKey: `collection#${collectionId}`,
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

async function connectChannelToConnection(organisationId: string, collectionId: string, teamId: string, domain: string, channelId: string) {
  const { tableName, dynamoDb } = initialise();

  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `organisation#${organisationId}`,
      sortKey: `collection#${collectionId}`,
    },

    UpdateExpression: "SET #d.#domain = :domain, #d.#teamId = :teamId, #d.#channelId = :channelId, #d.updated = :updated, updated = :updated, #gsi1PartitionKey = :gsi1PartitionKey, #gsi1SortKey = :gsi1SortKey, #gsi2PartitionKey = :gsi2PartitionKey, #gsi2SortKey = :gsi2SortKey",
    ExpressionAttributeNames: {
      "#d": "data",
      "#channelId": "channelId",
      "#domain": "domain",
      "#teamId": "teamId",
      "#gsi1PartitionKey": "gsi1PartitionKey",
      "#gsi1SortKey": "gsi1SortKey",
      "#gsi2PartitionKey": "gsi2PartitionKey",
      "#gsi2SortKey": "gsi2SortKey",
    },
    ExpressionAttributeValues: {
      ":channelId": channelId,
      ":domain": domain,
      ":teamId": teamId,
      ":updated": moment().format(),
      ":gsi1PartitionKey": `team#${teamId}`,
      ":gsi1SortKey": `channel#${channelId}`,
      ":gsi2PartitionKey": `domain#${domain}`,
      ":gsi2SortKey": `channel#${channelId}`,
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
  createCollection,
  getCollection,
  deleteCollection,
  connectChannelToConnection,
  getCollectionByChannel,
}
