import logger from "logger";
import {
  createUser,
  deleteUser,
  addUserToOrganisation,
  addUserToCollection,
  removeCollectionFromUsers,
  updateUser,
} from "./users";
import { IEventMessage } from "../models/events";
import { createCollection, deleteCollection } from "./collections";
import { InternalEventTypes } from "../services/internal-store";
import { notifyMentionnedInABookmark } from "./bookmarks";

export async function handleMessage(message: IEventMessage): Promise<boolean> {
  const data = message.data;
  logger.info("Handling the message", { message });
  let res: boolean = false;
  switch (message.type) {
    case eventType.userCreated:
      res = await createUser(data);
      break;
    case eventType.userUpdated:
      res = await updateUser(data);
      break;
    case eventType.userInternalOrganisationJoined:
      res = await addUserToOrganisation(data);
      break;
    case InternalEventTypes.slackInstallationCreated:
      res = true;
      break;
    case eventType.bookmarkNotificationCreated:
      res = await notifyMentionnedInABookmark(data);
      break;
    case eventType.collectionCreated:
      res = await createCollection(data);
      if (!res) {
        break;
      }
      res = await addUserToCollection({
        user: { uuid: data.collection.users[0] },
        collection: { uuid: data.collection.uuid, organisationId: data.collection.organisationId }
      });
      break;
    case eventType.userInternalCollectionJoined:
      res = await addUserToCollection(data);
      break;
    case eventType.collectionDeleted:
      res = await removeCollectionFromUsers(data);
      res = await deleteCollection(data);
      break;
    case eventType.userDeleted:
      res = await deleteUser(data);
      break;
    default:
      logger.error("Unexpected event type found in message. Sending to dead letter queue.", { message });
      res = false;
  }
  return res;
}

export enum eventType {
  userCreated = "USER_CREATED",
  userDeleted = "USER_DELETED",
  userUpdated = "USER_UPDATED",

  userInternalOrganisationJoined = "USER_INTERNAL_ORGANISATION_JOINED",
  userInternalCollectionJoined = "USER_INTERNAL_COLLECTION_JOINED",

  collectionCreated = "COLLECTION_CREATED",
  collectionDeleted = "COLLECTION_DELETED",

  bookmarkNotificationCreated = "BOOKMARK_NOTIFICATION_CREATED",
}
