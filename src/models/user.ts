export interface IUser {
  uuid: string;
  organisations: string[];
  collections: Array<{ organisationId: string; uuid: string }>;
  created?: string;
  updated?: string;
}
