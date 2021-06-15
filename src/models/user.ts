export interface IUser {
  uuid: string;
  organisations: string[];
  forename: string;
  surname: string;
  collections: Array<{ organisationId: string; uuid: string }>;
  created?: string;
  updated?: string;
}
