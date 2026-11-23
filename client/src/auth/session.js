const tokenKey = 'hotel.accessToken';
export const sessionEnded = 'hotel:session-ended';

export function getToken() {
  return sessionStorage.getItem(tokenKey);
}

export function saveToken(token) {
  sessionStorage.setItem(tokenKey, token);
}

export function endSession() {
  sessionStorage.removeItem(tokenKey);
  window.dispatchEvent(new Event(sessionEnded));
}

// The shared API helper can use this in place of fetch for /api requests.
export async function apiFetch(path, options = {}) {
  if (!path.startsWith('/api/') || new URL(path, location.origin).origin !== location.origin) {
    throw new Error('Expected a same-origin /api/ path');
  }
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && token && token === getToken()) endSession();
  return response;
}
