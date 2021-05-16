import { AxiosRequestConfig } from "axios";
import logger from "logger";
import { STS } from "aws-sdk";
import { AssumeRoleRequest, AssumeRoleResponse, Credentials } from 'aws-sdk/clients/sts';
import { promisify } from "util";
import { URL } from "url";
import aws4 from "aws4";
import moment from "dayjs";
import { createClient } from "../utils/http-client-helpers";

export interface IBookmarkCreateRequest {
  url: string;
  userId: string;
  collectionId: string;
  organisationId: string;
  origin: string;
}


const baseUrl = process.env.BASE_URL!;
const serviceRoleArn = process.env.SERVICE_ROLE!;

const awsService = "execute-api";
const awsRegion = process.env.AWS_REGION!;


const sts = new STS({ apiVersion: '2011-06-15' });


export function getHeaders(credentials: Credentials, path: string, data: Record<string, any>, correlationId: string): AxiosRequestConfig {
  const url = new URL(baseUrl);
  const requestOptions = {
    host: url.hostname,
    path,
    method: "POST",
    body: JSON.stringify(data),
    region: awsRegion,
    service: awsService,
    headers: {
      "Host": url.hostname,
      "Content-Type": "application/json",
      "Date": moment().toISOString(),
      "x-correlation-id": correlationId || "no-correlation-id"
    }
  }

  const signedOptions = aws4.sign(requestOptions, {
    secretAccessKey: credentials.SecretAccessKey,
    accessKeyId: credentials.AccessKeyId,
    sessionToken: credentials.SessionToken
  });

  return {
    headers: signedOptions.headers
  };
}

async function getRoleCredentials(sessionId: string): Promise<Credentials | undefined> {
  const assumeRoleRequest = {
    RoleArn: serviceRoleArn,
    RoleSessionName: `bkmark-slack-${sessionId}`
  };

  function assumeRoleFunction(params: AssumeRoleRequest, cb: (err: AWS.AWSError, data: AssumeRoleResponse) => void) {
    return sts.assumeRole(params, (err, data) => cb(err, data));
  }

  const assumeRole = promisify(assumeRoleFunction);

  const response = await assumeRole(assumeRoleRequest);
  return response.Credentials;
}


async function requestBookmarkCreate(data: IBookmarkCreateRequest) {
  const client = createClient(baseUrl, undefined, 15000, true);

  const path = "/bkmark/internal/bookmarks";
  try {
    const credentials = await getRoleCredentials(logger.getCorrelationId());
    if (!credentials) {
      throw new Error("Failed to assume role");
    }
    const headers = getHeaders(credentials, path, data, logger.getCorrelationId());

    await client.post(path, data, headers);
  } catch (error) {
    logger.error("There was an issue contacting the bookmarks service", { error, data });
    throw new Error(error.message || "There was an error contacting the bookmarks service");
  }
}

export default {
  requestBookmarkCreate,
}
