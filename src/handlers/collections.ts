import database from "../services/database/database";
import logger from "logger";
import { ICreateCollectionRequest, IDeleteCollectionRequest } from "../schemas/collections";
import { ICollection } from "../models/collection";


export async function deleteCollection(data: IDeleteCollectionRequest): Promise<boolean> {
  try {
    await database.deleteCollection(data.collection.organisationId, data.collection.uuid);
    return true;
  } catch (error) {
    logger.error("There was an error deleting a collection", { error, data });
    return false;
  }
}

export async function createCollection(data: ICreateCollectionRequest): Promise<boolean> {
  try {
    const collection: ICollection = {
      uuid: data.collection.uuid,
      organisationId: data.collection.organisationId,
    };
    await database.createCollection(collection);
    return true;
  } catch (error) {
    logger.error("There was an error creating a collection", { error, data });
    return false;
  }
}