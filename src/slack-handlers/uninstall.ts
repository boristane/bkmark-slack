import logger from "logger";
import internalStore, { InternalEventTypes } from "../services/internal-store";
import { ISlackUninstalled } from '../models/internal-events';
import { AppUninstalledEvent } from "@slack/bolt";


export async function handleUninstallApp(event: AppUninstalledEvent) {
  logger.info("Received a app_uninstalled event", event);
  const e: ISlackUninstalled = {
    //@ts-ignore
    uuid: event.team_id,
    data: { event },
    type: InternalEventTypes.slackInstallationCreated,
  }
  await internalStore.createInternalEvent(e);
}