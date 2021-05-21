export interface ICreateCollectionRequest {
  collection: { uuid: string, organisationId: string; };
}

export interface IDeleteCollectionRequest {
  collection: { uuid: string; organisationId: string, userId: string; users: string[]; };
}
