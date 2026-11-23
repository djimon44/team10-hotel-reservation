import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, endSession, getToken, saveToken, sessionEnded } from './session.js';

const AuthContext = createContext(null);

async function submitCredentials(action, fields) {
  const response = await fetch('/api/auth/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.details?.[0];
    throw new Error(detail ? detail.field + ': ' + detail.message : data.error);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    function clear() {
      setUser(null);
      setLoading(false);
      setError('');
    }
    window.addEventListener(sessionEnded, clear);
    const token = getToken();
    const controller = new AbortController();
    async function restore() {
      try {
        const response = await apiFetch('/api/auth/me', { signal: controller.signal });
        if (response.status === 401) return;
        if (!response.ok) throw new Error('Could not restore session');
        const data = await response.json();
        if (!controller.signal.aborted && token === getToken()) setUser(data.user);
      } catch {
        if (!controller.signal.aborted && token === getToken()) {
          setError('Could not load your account. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted && token === getToken()) setLoading(false);
      }
    }
    if (token) restore();
    return () => {
      controller.abort();
      window.removeEventListener(sessionEnded, clear);
    };
  }, [attempt]);

  async function login(fields) {
    const data = await submitCredentials('login', fields);
    saveToken(data.token);
    setUser(data.user);
    setError('');
    setLoading(false);
  }

  function retry() {
    setLoading(true);
    setError('');
    setAttempt(value => value + 1);
  }

  return <AuthContext.Provider value={{
    user, loading, error, retry, login, logout: endSession,
    register: fields => submitCredentials('register', fields),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('Wrap the router content in AuthProvider');
  return auth;
}
