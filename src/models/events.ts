export interface IEventMessage {
  uuid: string | number;
  data: any;
  version: number;
  source: string;
  type: string;
}