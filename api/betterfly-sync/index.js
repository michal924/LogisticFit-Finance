// ============================================================
//  Finance LogisticFit — Backend: pobieranie faktur z Comarch Betterfly
//  Używane dla kontekstu SPÓŁKA (JDG korzysta z inFakt — patrz infakt-sync).
//  Sekrety serwer-side: BETTERFLY_CLIENT_ID + BETTERFLY_CLIENT_SECRET.
//  Endpoint: GET /api/betterfly-sync?type=invoices|purchase&page=1[&raw=1]
//  Tylko ODCZYT (GET) — nic nie zapisujemy do Betterfly.
// ============================================================

const BF_BASE = 'https://app.comarchbetterfly.pl';
const BF_VERSION = 'v1.4';
const PAGE_SIZE = 50;

// Token OAuth2 żyje 600 s. Cache w pamięci instancji (warm start) z marginesem 60 s.
let tokenCache = { value: '', expiresAt: 0 };

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

module.exports = async function (context, req) {
  const clientId = process.env.BETTERFLY_CLIENT_ID;
  const clientSecret = process.env.BETTERFLY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    context.res = {
      status: 500,
      body: { error: 'Brak BETTERFLY_CLIENT_ID / BETTERFLY_CLIENT_SECRET w konfiguracji serwera' },
    };
    return;
  }

  const type = (req.query.type || 'invoices').toLowerCase();   // invoices | purchase
  const page = parseInt(req.query.page || '1', 10);
  const skip = (page - 1) * PAGE_SIZE;

  // Faktury sprzedaży /invoices, faktury zakupu /purchaseinvoices
  const TYPE_PATH = { invoices: 'invoices', purchase: 'purchaseinvoices' };

  // Tryb diagnostyczny ?probe=1 — omiata warianty zasobów/wersji, żeby ustalić który
  // endpoint faktycznie zawiera dane (koszt bywa w vatpurchasebooks, nie purchaseinvoices).
  if (req.query.probe) {
    const RESOURCES = ['invoices', 'purchaseinvoices', 'vatpurchasebooks', 'correctiveinvoices', 'advanceinvoices'];
    const VERSIONS = ['v1.5', 'v1.4', 'v1.2'];
    try {
      const token = await getToken(clientId, clientSecret);
      const results = [];
      for (const ver of VERSIONS) {
        for (const rsc of RESOURCES) {
          const u = `${BF_BASE}/api2/public/${ver}/${rsc}?$top=1`;
          try {
            const r = await fetch(u, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
            const txt = await r.text();
            let count = null, keys = null;
            try {
              const j = JSON.parse(txt);
              const arr = Array.isArray(j) ? j : (j.Items || j.items || j.Data || j.data || j.Results || j.value || null);
              count = Array.isArray(arr) ? arr.length : null;
              keys = Array.isArray(j) ? 'array' : Object.keys(j).slice(0, 8);
            } catch { /* nie-JSON */ }
            let sample;
            if (req.query.full && count > 0) {
              try { const j2 = JSON.parse(txt); const arr2 = Array.isArray(j2) ? j2 : (j2.Items || j2.items || j2.Data || j2.data || j2.Results || j2.value); sample = arr2[0]; } catch {}
            }
            results.push({ ver, rsc, status: r.status, count, keys, sample, snippet: r.ok ? undefined : txt.slice(0, 120) });
          } catch (e) { results.push({ ver, rsc, error: String(e.message || e) }); }
        }
      }
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { probe: results } };
    } catch (e) {
      context.res = { status: 500, body: { error: 'Probe: ' + (e.message || String(e)) } };
    }
    return;
  }

  const path = TYPE_PATH[type] || 'invoices';
  const qs = `$orderby=${encodeURIComponent('IssueDate desc, Id desc')}&$skip=${skip}&$top=${PAGE_SIZE}`;
  const url = `${BF_BASE}/api2/public/${BF_VERSION}/${path}?${qs}`;

  try {
    const token = await getToken(clientId, clientSecret);

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const txt = await res.text();
      context.res = { status: res.status, body: { error: 'Betterfly API: ' + txt.slice(0, 400) } };
      return;
    }

    const data = await res.json();
    // Kształt odpowiedzi nie jest udokumentowany — normalizujemy jak przy inFakt
    const items = Array.isArray(data)
      ? data
      : (data.Items || data.items || data.Data || data.data || data.Results || data.value || []);

    // ?raw=1 — podgląd surowego pierwszego rekordu (weryfikacja nazw pól i jednostek kwot)
    if (req.query.raw) {
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { type, page, count: items.length, sample: items[0] || null, envelope: Array.isArray(data) ? 'array' : Object.keys(data) },
      };
      return;
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { type, page, count: items.length, pageSize: PAGE_SIZE, items },
    };
  } catch (e) {
    context.res = { status: 500, body: { error: 'Wyjątek serwera: ' + (e.message || String(e)) } };
  }
};
