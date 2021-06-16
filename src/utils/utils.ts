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

export const findObject = (obj: Record<string, any>, key: string, value: any) => {
  const result: Record<string, any>[] = [];
  const recursiveSearch = (obj: Record<string, any> = {}) => {
    if (!obj || typeof obj !== 'object') {
      return;
    };
    if (obj[key] === value) {
      result.push(obj);
    };
    Object.keys(obj).forEach(function (k) {
      recursiveSearch(obj[k]);
    });
  }
  recursiveSearch(obj);
  return result;
}

export function removeHTMLTags(str: string) {
  if (!str) return str;
  return str.toString().replace(/(<([^>]+)>)/ig, "");
}
