import { EventBridge } from "aws-sdk";
import logger from "logger";

function initialise(): { busName: string, eventBridge: EventBridge } {
  const tableName = process.env.EVENT_BUS_NAME || "";
  return initialiseEventBus(tableName);
}

export function initialiseEventBus(busName: string): { busName: string, eventBridge: EventBridge } {
  const isOffline = process.env.ENV === "offline" ? true : false;

  const eventBridge = isOffline ?
    new EventBridge(
      {
        region: "localhost",
        endpoint: "http://localhost:4010",
      }) :
    new EventBridge({ region: process.env.REGION });
  return { busName, eventBridge };
}

async function fanoutEntries(data: Record<string, any>[], source: string) {
  const { busName, eventBridge } = initialise();
  const entries = data.map(d => {
    return {
      EventBusName: busName,
      Source: source,
      DetailType: d.type || "UNKNOWN",
      Detail: JSON.stringify(d),
    }
  })
  const response = await eventBridge.putEvents({
    Entries: entries,
  }).promise();
  if (response.FailedEntryCount && response.FailedEntryCount > 1) {
    const message = "Error sending events to the event bus"
    logger.error(message, { eventsNotSent: response.Entries?.map(e => e.ErrorCode) });
    throw new Error(message);
  }
  logger.debug("Sent records to the event bridge", { entries, response, data });
}

export default {
  fanoutEntries,
}
