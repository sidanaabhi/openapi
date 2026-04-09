import React from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/msalConfig';
import App from './App';
import './styles/global.css';

msalInstance.initialize().then(() => {
  // Handle redirect response and set the active account explicitly (fixes account confusion)
  msalInstance.handleRedirectPromise().then(response => {
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }
    }
  });

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
});
