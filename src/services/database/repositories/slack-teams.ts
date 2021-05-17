import { IDatabaseItem, initialise } from "../init";
import logger from "logger";
import moment from "dayjs";
import { ISlackTeam } from "../../../models/slack-team";

async function createSlackTeam(slackTeam: ISlackTeam): Promise<void> {
  const { tableName, dynamoDb } = initialise();
  slackTeam.created = moment().format();
  slackTeam.updated = moment().format();

  const dbUser: IDatabaseItem = {
    partitionKey: `slack-team#${slackTeam.id}`,
    sortKey: `slack-team#${slackTeam.id}`,
    gsi1PartitionKey: `slack-team#${slackTeam.domain || 'no-domain'}`,
    gsi1SortKey: `slack-team#${slackTeam.domain || 'no-domain'}`,
    data: slackTeam,
    created: slackTeam.created,
    updated: slackTeam.updated,
    type: "slack-team",
  };
  const params = {
    TableName: tableName,
    Item: dbUser,
  };

  try {
    await dynamoDb.put(params).promise();
  } catch (e) {
    const message = "Failed to save a slack team in dynamo db";
    logger.error(message, { params, error: e });
    throw e;
  }
}

async function getSlackTeam(teamId: string): Promise<ISlackTeam | undefined> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    Key: {
      partitionKey: `slack-team#${teamId}`,
      sortKey: `slack-team#${teamId}`,
    },
    ProjectionExpression: "#d",
    ExpressionAttributeNames: {
      "#d": "data",
    },
  };
  try {
    const record = await dynamoDb.get(params).promise();
    if (!record.Item) {
      return;
    }
    return record.Item.data as ISlackTeam;
  } catch (e) {
    logger.error("Error getting the slack team", { params, error: e });
  }
}

async function getSlackTeamByDomain(domain: string): Promise<ISlackTeam> {
  const { tableName, dynamoDb } = initialise();
  const params = {
    TableName: tableName,
    IndexName: "gsi1",
    KeyConditionExpression: "#gsi1PartitionKey = :gsi1PartitionKey and #gsi1SortKey = :gsi1SortKey",
    ExpressionAttributeNames: {
      "#gsi1PartitionKey": "gsi1PartitionKey",
      "#gsi1SortKey": "gsi1SortKey",
      "#data": "data",
    },
    ProjectionExpression: "#data",
    ExpressionAttributeValues: {
      ":gsi1PartitionKey": `slack-team#${domain}`,
      ":gsi1SortKey": `slack-team#${domain}`,
    },
    ScanIndexForward: false,
  };

  try {
    const records = await dynamoDb.query(params).promise();
    if (records.Items) {
      const [team,] = records.Items.map((item) => item.data) as ISlackTeam[];
      return team;
    } else {
      throw new Error("Can't find slack-team by domain");
    }
  } catch (e) {
    logger.error("Error getting the slack team by domain", { params, error: e });
    throw e;
  }
}

export default {
  getSlackTeam,
  createSlackTeam,
  getSlackTeamByDomain,
}
