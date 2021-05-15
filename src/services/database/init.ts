import { DynamoDB } from "aws-sdk";
import { initialiseDb } from "../../utils/db-helpers";

export function initialise(): { tableName: string, dynamoDb: DynamoDB.DocumentClient } {
  const tableName = process.env.PROJECTION_TABLE!;
  return initialiseDb(tableName);
}

export interface IDatabaseItem {
  partitionKey: string;
  sortKey: string;
  gsi1PartitionKey?: string;
  gsi1SortKey?: string;
  data: Record<string, any>;
  created: string;
  updated: string;
  type: string;
}