import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';

export type AuthStatus = 'idle' | 'loading' | 'logged_in' | 'error';

export function useAuth() {
  const { instance, accounts } = useMsal();
  const [status, setStatus] = useState<AuthStatus>(accounts.length > 0 ? 'logged_in' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = accounts.length > 0;
  const user = accounts[0] ?? null;

  async function login() {
    setStatus('loading');
    setError(null);
    try {
      // Redirect — nie wymaga zgody na popupy
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd logowania');
      setStatus('error');
    }
  }

  async function logout() {
    await instance.logoutRedirect();
    setStatus('idle');
  }

  return { isLoggedIn, user, status, error, login, logout, msalInstance: instance };
}
