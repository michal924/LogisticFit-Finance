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

export const SHAREPOINT_SITE_ID = 'logisticfit.sharepoint.com,d6919769-9612-452f-b698-f9f3296caaca,6cd9f1ba-30f7-474d-8317-baa9693f27c1';
export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
