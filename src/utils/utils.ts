import logger from "logger";

export function logRequest(event: any) {
  logger.info("REQUEST", {
    url: event.resource,
    body: JSON.parse(event.body),
    query: event.queryStringParameters,
    method: event.requestContext.httpMethod,
    token: event.headers.Authorization,
    authorizer: event.requestContext.authorizer,
    host: event.headers.Host,
  });
}

export function logResponse(response: Record<string, any> | undefined, event: any): void {
  logger.info("RESPONSE", {
    ...response,
    url: event.resource,
  });
}
