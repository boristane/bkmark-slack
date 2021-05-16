import { IEventMessage } from "../models/events";
import AWSXRay from 'aws-xray-sdk';
import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export function buildEventMessage(data: any, eventType: string, eventVersion: number): IEventMessage {
  return {
    uuid: data.uuid,
    data: data,
    source: "bookmarks",
    type: eventType,
    version: eventVersion,
  }
}

export function initialiseXray(): void {
  AWSXRay.captureHTTPsGlobal(http, false);
  AWSXRay.captureHTTPsGlobal(https, false);
  AWSXRay.capturePromise();
}

export function createClient(url: string, additionalConfig?: AxiosRequestConfig, timeout = 10000, enableXray = false): AxiosInstance {
  if (enableXray) {
    initialiseXray();
  }
  const conf: AxiosRequestConfig = {
    ...additionalConfig,
    baseURL: url,
    timeout: timeout
  };
  return axios.create(conf);
}
