import type { Configuration, PopupRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: '5f59c32f-a72b-41d7-bcd7-ec0b7f5f55c1',
    authority: 'https://login.microsoftonline.com/8ac2d776-ee71-46a1-a2ca-da0553d51285',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'Sites.ReadWrite.All'],
};

// Dedykowana witryna /sites/finance (przepięta z root site 2026-06-05)
export const SHAREPOINT_SITE_ID = 'logisticfit.sharepoint.com,d6957fc8-14ef-4125-8bcc-f9a1a10bbf7f,c0d9bbfe-eece-487a-9d9a-85e0036ab50c';
export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
