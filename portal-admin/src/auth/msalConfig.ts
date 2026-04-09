import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID ?? 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
      },
      logLevel: LogLevel.Error,
    },
  },
};

export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    `api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`,
  ],
};

export const msalInstance = new PublicClientApplication(msalConfig);
