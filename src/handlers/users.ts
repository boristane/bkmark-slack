import database from "../services/database/database";
import logger from "logger";
import { IUser } from "../models/user";
import { ICreateUserRequest, IDeleteUserRequest, IAddUserToOrganisationRequest, IAddUserToCollectionRequest, IRemoveCollectionFromUsersRequest, IUpdateUserRequest } from "../schemas/users";

export async function createUser(data: ICreateUserRequest): Promise<boolean> {
  try {
    const user: IUser = {
      uuid: data.user.uuid,
      forename: data.user.forename,
      surname: data.user.surname,
      organisations: [],
      collections: [],
    };
    await database.createUser(user);
    return true;
  } catch (error) {
    logger.error("There was an error creating a user", { error, data });
    return false;
  }
}

export async function updateUser(data: IUpdateUserRequest): Promise<boolean> {
  try {
    const { user, oldUser } = data;
    if (user.forename === oldUser.forename && user.surname === oldUser.surname) {
      logger.info("No change to user forename and surname, nothing to do, return.");
      return true;
    }
    await database.editUser(user.uuid, user.forename, user.surname);
    return true;
  } catch (error) {
    logger.error("There was an error updating a user", { error, data });
    return false;
  }
}

export async function deleteUser(data: IDeleteUserRequest): Promise<boolean> {
  try {
    await database.deleteUser(data.user.uuid);
    return true;
  } catch (error) {
    logger.error("There was an error deleting a user", { error, data });
    return false;
  }
}

export async function addUserToOrganisation(data: IAddUserToOrganisationRequest) {
  try {
    await database.appendOrganisationToUser(data.user.uuid, data.organisation.uuid);
    return true;
  } catch (error) {
    logger.error("There was an error adding a user to an organisation", { error, data });
    return false;
  }
}

export async function addUserToCollection(data: IAddUserToCollectionRequest) {
  try {
    await database.appendCollectionToUser(data.user.uuid, data.collection.organisationId, data.collection.uuid);
    return true;
  } catch (error) {
    logger.error("There was an error adding a user to a collection", { error, data });
    return false;
  }
}

export async function removeCollectionFromUsers(data: IRemoveCollectionFromUsersRequest) {
  try {
    const userIds = await data.collection.users;
    const promises = userIds.map(async id => {
      const user = await database.getUser(id);
      const index = user.collections?.findIndex(collection => collection.uuid === data.collection.uuid && collection.organisationId === data.collection.organisationId);
      if (!index) {
        return;
      }
      await database.removeCollectionFromUser(user.uuid, index);
    });

    await Promise.all(promises);
    return true;
  } catch (error) {
    logger.error("There was an error adding a user to a collection", { error, data });
    return false;
  }
}
