export interface IInternalEvent {
  uuid: string;
  data: {
    [key: string]: string;
    correlationId: string;
  };
  type: string;
  timestamp: number;
  correlationId: string;
}

export interface ISlackInstallationCreated {
  uuid: string
  data: Record<string, any>;
  type: string;
}

export interface ISlackUninstalled {
  uuid: string
  data: Record<string, any>;
  type: string;
}

export interface IBookmarkCreateRequestSent {
  uuid: string
  data: Record<string, any>;
  type: string;
}
