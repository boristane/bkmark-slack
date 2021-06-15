export interface ICreateUserRequest {
  user: {
    uuid: string;
    forename: string;
    surname: string;
  };
}

export interface IUpdateUserRequest {
  oldUser: Record<string, any>;
  user: Record<string, any>;
}

export interface IDeleteUserRequest {
  user: {
    uuid: string;
  };
}

export interface IAddUserToOrganisationRequest {
  user: { uuid: string };
  organisation: { uuid: string };
}

export interface IAddUserToCollectionRequest {
  user: { uuid: string };
  collection: { uuid: string, organisationId: string; };
}

export interface IRemoveCollectionFromUsersRequest {
  collection: { uuid: string; organisationId: string, userId: string; users: string[]; };
}
