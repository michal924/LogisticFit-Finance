// Wspólny klient Microsoft Graph dla skryptów setup/ (Node 18+, bez zależności).
//
// Logowanie: device code flow na tej samej rejestracji aplikacji co frontend
// (src/auth/msalConfig.ts). Pierwsze uruchomienie pokazuje kod do wpisania na
// https://microsoft.com/devicelogin. Refresh token trafia do
// ~/.logisticfit-finance/token.json (uprawnienia 0600), więc kolejne uruchomienia,
// także z harmonogramu, działają bez logowania. Token wygasa po ok. 90 dniach
// nieużywania, wtedy trzeba raz zalogować się ponownie.

import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TENANT_ID = '8ac2d776-ee71-46a1-a2ca-da0553d51285';
export const CLIENT_ID = '5f59c32f-a72b-41d7-bcd7-ec0b7f5f55c1';
export const SITE_ID =
  'logisticfit.sharepoint.com,d6957fc8-14ef-4125-8bcc-f9a1a10bbf7f,c0d9bbfe-eece-487a-9d9a-85e0036ab50c';
export const LIBRARIES = ['Finance JDG', 'Finance Spółka', 'Finance Prywatne'];
export const GRAPH = 'https://graph.microsoft.com/v1.0';

const SCOPES = 'offline_access User.Read Sites.ReadWrite.All';
const AUTH = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;
const CACHE_DIR = join(homedir(), '.logisticfit-finance');
const CACHE_FILE = join(CACHE_DIR, 'token.json');

let accessToken = null;
let accessExpires = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tokenRequest(params) {
  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  return { ok: res.ok, body: await res.json() };
}

async function saveTokens(body) {
  accessToken = body.access_token;
  accessExpires = Date.now() + (body.expires_in - 120) * 1000;
  if (body.refresh_token) {
    await mkdir(CACHE_DIR, { recursive: true, mode: 0o700 });
    await writeFile(CACHE_FILE, JSON.stringify({ refresh_token: body.refresh_token }), { mode: 0o600 });
    await chmod(CACHE_FILE, 0o600);
  }
}

async function tryRefresh() {
  let cached;
  try {
    cached = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return false;
  }
  const { ok, body } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: cached.refresh_token,
    scope: SCOPES,
  });
  if (!ok) return false;
  await saveTokens(body);
  return true;
}

async function deviceLogin({ interactive }) {
  if (!interactive) {
    throw new Error(
      'Brak ważnego tokenu, a skrypt działa bez terminala. Uruchom go raz ręcznie, żeby się zalogować.',
    );
  }
  const res = await fetch(`${AUTH}/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES }),
  });
  const dc = await res.json();
  if (!res.ok) throw new Error(`Device code: ${dc.error_description || dc.error}`);
  console.log(`\n${dc.message}\n`);

  const deadline = Date.now() + dc.expires_in * 1000;
  let interval = (dc.interval || 5) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    const { ok, body } = await tokenRequest({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: dc.device_code,
    });
    if (ok) {
      await saveTokens(body);
      console.log('Zalogowano.\n');
      return;
    }
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') { interval += 5000; continue; }
    if (String(body.error_description).includes('AADSTS7000218')) {
      throw new Error(
        'Rejestracja aplikacji nie pozwala na logowanie z terminala. W Entra ID: App registrations → ' +
          'aplikacja Finance → Authentication → "Allow public client flows" = Yes.',
      );
    }
    throw new Error(`Logowanie: ${body.error_description || body.error}`);
  }
  throw new Error('Kod logowania wygasł. Uruchom skrypt ponownie.');
}

export async function getToken({ interactive = process.stdin.isTTY } = {}) {
  if (accessToken && Date.now() < accessExpires) return accessToken;
  if (await tryRefresh()) return accessToken;
  await deviceLogin({ interactive });
  return accessToken;
}

// Zapytanie do Graph z ponawianiem przy 429/5xx i odświeżeniem tokenu przy 401.
export async function graph(method, pathOrUrl, body, { raw = false } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const token = await getToken();
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && attempt === 0) { accessToken = null; continue; }
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await sleep(wait * 1000);
      continue;
    }
    if (raw) return res;
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Graph ${method} ${url} → ${res.status}: ${text}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  throw new Error(`Graph ${method} ${url}: zbyt wiele nieudanych prób`);
}

// Zwraca wszystkie elementy z kolekcji stronicowanej (@odata.nextLink).
export async function graphAll(path) {
  const out = [];
  let next = path;
  while (next) {
    const page = await graph('GET', next);
    out.push(...(page.value || []));
    next = page['@odata.nextLink'];
  }
  return out;
}

// Mapa nazwa biblioteki → drive (id, name, webUrl) dla witryny Finance.
export async function getLibraryDrives() {
  const drives = await graphAll(`/sites/${SITE_ID}/drives?$select=id,name,webUrl`);
  const byName = new Map(drives.map((d) => [d.name, d]));
  const missing = LIBRARIES.filter((n) => !byName.has(n));
  if (missing.length) {
    throw new Error(
      `Nie znaleziono bibliotek: ${missing.join(', ')}. Dostępne: ${drives.map((d) => d.name).join(', ')}`,
    );
  }
  return byName;
}
