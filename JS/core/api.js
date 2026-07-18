/**
 * EstacionaPro — Core: cliente de la API.
 * Base relativa: el frontend se sirve desde el mismo origen que el backend.
 */

const TOKEN_KEY = 'ep_admin_token';

export function getToken()  { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

/** Realiza una petición JSON. Lanza Error con .status y mensaje del backend. */
async function request(method, path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${getToken()}`;
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('No se pudo conectar con el servidor.');
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get:   (p, auth = false)        => request('GET', p, undefined, auth),
  post:  (p, body, auth = false)  => request('POST', p, body, auth),
  patch: (p, body, auth = false)  => request('PATCH', p, body, auth),
};

/** Verifica credenciales de admin/operador y guarda el token. */
export async function login(password) {
  const { token } = await api.post('/api/auth', { password });
  setToken(token);
  return token;
}
