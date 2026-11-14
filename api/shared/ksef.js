// ============================================================
//  Klient KSeF API 2.0 (Krajowy System e-Faktur) dla funkcji API.
//  Uwierzytelnianie tokenem KSeF: challenge → token|timestampMs zaszyfrowany
//  RSA-OAEP SHA-256 kluczem MF → status → redeem (access + refresh token).
//  Konfiguracja (server-side): KSEF_TOKEN, KSEF_NIP, opcjonalnie KSEF_ENV=test|demo|prod.
//  Token KSeF generuje się w Aplikacji Podatnika KSeF z uprawnieniem InvoiceRead.
//  Tylko ODCZYT faktur.
// ============================================================

const crypto = require('node:crypto');

const ENVIRONMENTS = {
  prod: { api: 'https://api.ksef.mf.gov.pl/v2',      qr: 'https://qr.ksef.mf.gov.pl' },
  demo: { api: 'https://api-demo.ksef.mf.gov.pl/v2', qr: 'https://qr-demo.ksef.mf.gov.pl' },
  test: { api: 'https://api-test.ksef.mf.gov.pl/v2', qr: 'https://qr-test.ksef.mf.gov.pl' },
};

function env() {
  return ENVIRONMENTS[(process.env.KSEF_ENV || 'prod').toLowerCase()] || ENVIRONMENTS.prod;
}

function config() {
  const token = process.env.KSEF_TOKEN;
  const nip = (process.env.KSEF_NIP || '').replace(/\D/g, '');
  return token && nip.length === 10 ? { token, nip } : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache sesji w pamięci instancji (warm start)
let session = { access: '', accessUntil: 0, refresh: '', refreshUntil: 0 };

async function call(method, path, { bearer, body, accept = 'application/json' } = {}) {
  const res = await fetch(`${env().api}${path}`, {
    method,
    headers: {
      Accept: accept,
      'X-Error-Format': 'problem-details',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`KSeF ${method} ${path} → ${res.status}: ${txt.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function tokenEncryptionKey() {
  const certs = await (await call('GET', '/security/public-key-certificates')).json();
  const now = Date.now();
  const cert = certs.find((c) => (c.usage || []).includes('KsefTokenEncryption') &&
    Date.parse(c.validFrom) <= now && now < Date.parse(c.validTo));
  if (!cert) throw new Error('KSeF: brak aktywnego klucza KsefTokenEncryption');
  const x509 = new crypto.X509Certificate(Buffer.from(cert.certificate, 'base64'));
  return x509.publicKey;
}

async function authenticate(cfg) {
  const challenge = await (await call('POST', '/auth/challenge')).json();
  const key = await tokenEncryptionKey();
  const encryptedToken = crypto.publicEncrypt(
    { key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(`${cfg.token}|${challenge.timestampMs}`, 'utf8'),
  ).toString('base64');

  const init = await (await call('POST', '/auth/ksef-token', {
    body: {
      challenge: challenge.challenge,
      contextIdentifier: { type: 'Nip', value: cfg.nip },
      encryptedToken,
    },
  })).json();
  const authToken = init.authenticationToken.token;

  // Status: 100 = w toku, 200 = sukces, >= 400 = błąd
  for (let i = 0; i < 30; i++) {
    const st = await (await call('GET', `/auth/${encodeURIComponent(init.referenceNumber)}`, { bearer: authToken })).json();
    const code = st.status?.code;
    if (code === 200) break;
    if (code && code >= 400) {
      throw new Error(`KSeF uwierzytelnianie odrzucone (${code}): ${st.status.description} ${(st.status.details || []).join(' ')}`);
    }
    if (i === 29) throw new Error('KSeF: przekroczono czas oczekiwania na uwierzytelnienie');
    await sleep(1000);
  }

  const tokens = await (await call('POST', '/auth/token/redeem', { bearer: authToken })).json();
  session = {
    access: tokens.accessToken.token,
    accessUntil: Date.parse(tokens.accessToken.validUntil) - 60_000,
    refresh: tokens.refreshToken.token,
    refreshUntil: Date.parse(tokens.refreshToken.validUntil) - 60_000,
  };
}

async function accessToken() {
  const cfg = config();
  if (!cfg) {
    const err = new Error('KSeF nie jest skonfigurowany (KSEF_TOKEN, KSEF_NIP)');
    err.status = 503;
    throw err;
  }
  const now = Date.now();
  if (session.access && now < session.accessUntil) return session.access;
  if (session.refresh && now < session.refreshUntil) {
    try {
      const r = await (await call('POST', '/auth/token/refresh', { bearer: session.refresh })).json();
      session.access = r.accessToken.token;
      session.accessUntil = Date.parse(r.accessToken.validUntil) - 60_000;
      return session.access;
    } catch { /* refresh nieudany → pełne uwierzytelnienie */ }
  }
  await authenticate(cfg);
  return session.access;
}

// Zapytanie z automatycznym ponowieniem uwierzytelnienia przy 401
async function authed(method, path, opts = {}) {
  try {
    return await call(method, path, { ...opts, bearer: await accessToken() });
  } catch (e) {
    if (e.status !== 401) throw e;
    session = { access: '', accessUntil: 0, refresh: '', refreshUntil: 0 };
    return call(method, path, { ...opts, bearer: await accessToken() });
  }
}

const DAY = 86_400_000;
const MAX_WINDOW_DAYS = 90; // limit API: 100 dni na zapytanie

/**
 * Metadane faktur zakupowych (podmiot = nabywca, Subject2) z zakresu dat wystawienia.
 * Dzieli zakres na okna ≤ 90 dni i przechodzi przez wszystkie strony.
 */
async function listPurchaseInvoices(fromDate, toDate) {
  const out = [];
  let start = Date.parse(`${fromDate}T00:00:00Z`);
  const end = Date.parse(`${toDate}T23:59:59Z`);
  while (start <= end) {
    const windowEnd = Math.min(end, start + MAX_WINDOW_DAYS * DAY - 1000);
    let pageOffset = 0;
    for (;;) {
      const res = await (await authed('POST',
        `/invoices/query/metadata?sortOrder=Asc&pageOffset=${pageOffset}&pageSize=100`, {
          body: {
            subjectType: 'Subject2',
            dateRange: {
              dateType: 'Issue',
              from: new Date(start).toISOString(),
              to: new Date(windowEnd).toISOString(),
            },
          },
        })).json();
      out.push(...(res.invoices || []));
      if (!res.hasMore || res.isTruncated) break; // 10 000 rekordów w oknie 90 dni nam nie grozi
      pageOffset++;
    }
    start = windowEnd + 1000;
  }
  return out;
}

async function getInvoiceXml(ksefNumber) {
  const res = await authed('GET', `/invoices/ksef/${encodeURIComponent(ksefNumber)}`, { accept: 'application/xml' });
  return Buffer.from(await res.arrayBuffer());
}

// KOD I: link weryfikacyjny faktury (NIP sprzedawcy, data wystawienia DD-MM-RRRR, SHA-256 XML w Base64URL)
function verificationUrl(sellerNip, issueDateIso, xmlBuffer) {
  const [y, m, d] = issueDateIso.slice(0, 10).split('-');
  const hash = crypto.createHash('sha256').update(xmlBuffer).digest('base64url');
  return `${env().qr}/invoice/${sellerNip}/${d}-${m}-${y}/${hash}`;
}

module.exports = { config, listPurchaseInvoices, getInvoiceXml, verificationUrl };
