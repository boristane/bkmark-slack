import database from "../services/database/database";
import logger from "logger";
import { IDeleteCollectionRequest } from "../schemas/users";


export async function deleteCollection(data: IDeleteCollectionRequest): Promise<boolean> {
  try {
    await database.deleteCollection(data.collection.organisationId, data.collection.uuid);
    return true;
  } catch (error) {
    logger.error("There was an error deleting a collection", { error, data });
    return false;
  }
}