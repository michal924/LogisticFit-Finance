// ============================================================
//  Wspólny klient Comarch Betterfly dla funkcji API (betterfly-sync, betterfly-pdf).
//  Folder bez function.json, więc Azure Functions nie wystawia go jako endpointu.
// ============================================================

const BF_BASE = 'https://app.comarchbetterfly.pl';

// Token OAuth2 żyje 600 s. Cache w pamięci instancji (warm start) z marginesem 60 s.
let tokenCache = { value: '', expiresAt: 0 };

function resetToken() {
  tokenCache = { value: '', expiresAt: 0 };
}

async function getToken(clientId, clientSecret) {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${BF_BASE}/api2/public/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Autoryzacja Betterfly (${res.status}): ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  const token = data.access_token || data.accessToken;
  if (!token) throw new Error('Betterfly nie zwrócił access_token');

  const ttl = Number(data.expires || data.expires_in || 600);
  tokenCache = { value: token, expiresAt: Date.now() + Math.max(60, ttl - 60) * 1000 };
  return token;
}

// GET z autoryzacją; przy 401/invalid_token jeden retry ze świeżym tokenem.
async function bfGet(url, clientId, clientSecret) {
  const authedGet = (tok) => fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tok}`, 'Accept': 'application/json' },
  });

  let res = await authedGet(await getToken(clientId, clientSecret));
  if (res.status === 401 || res.status === 403) {
    let txt = '';
    try { txt = await res.clone().text(); } catch {}
    if (res.status === 401 || /invalid_token|access_token/i.test(txt)) {
      resetToken();
      res = await authedGet(await getToken(clientId, clientSecret));
    }
  }
  return res;
}

module.exports = { BF_BASE, getToken, resetToken, bfGet };
