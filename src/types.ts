export type Options = {
  url: string;
  accessToken: string;
};

export type Connection = {
  status:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'authenticated'
    | 'error'
    | 'unknown';
  message?: string;
  timestamp: number;
};

export type Registration = {
  status:
    | 'unknown'
    // the integration is not installed or has no entries yet, so it isn't loaded
    | 'not_set_up'
    // waiting for the user to click "Add" on the discovered browser
    | 'pending'
    | 'ignored'
    | 'disabled'
    | 'registered';
  name?: string;
  device_registry_id?: string | null;
  entity_id?: string | null;
};
