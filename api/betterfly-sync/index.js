// ============================================================
//  Finance LogisticFit — Backend: pobieranie faktur z Comarch Betterfly
//  Używane dla kontekstu SPÓŁKA (JDG korzysta z inFakt — patrz infakt-sync).
//  Sekrety serwer-side: BETTERFLY_CLIENT_ID + BETTERFLY_CLIENT_SECRET.
//  Endpoint: GET /api/betterfly-sync?type=invoices|purchase&page=1[&raw=1]
//  Tylko ODCZYT (GET) — nic nie zapisujemy do Betterfly.
// ============================================================

const BF_BASE = 'https://app.comarchbetterfly.pl';
const PAGE_SIZE = 50;

// Zasób + wersja API zależą od typu dokumentu (ustalone diagnostyką ?probe=1):
//  - sprzedaż: v1.5/invoices
//  - koszt: v1.4/vatpurchasebooks (rejestr VAT zakupu — tam trafiają "koszty" z Betterfly;
//           purchaseinvoices to osobny, u nas pusty typ)
//  - customers: v1.2/customers (rozwiązywanie CustomerId → nazwa/NIP)
const RESOURCE_MAP = {
  invoices:  { path: 'invoices',         ver: 'v1.5' },
  purchase:  { path: 'vatpurchasebooks', ver: 'v1.4' },
  customers: { path: 'customers',        ver: 'v1.2' },
  proforma:  { path: 'proformas',        ver: 'v1.4' },
};

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

  const type = (req.query.type || 'invoices').toLowerCase();   // invoices | purchase | customers
  const page = parseInt(req.query.page || '1', 10);
  const skip = (page - 1) * PAGE_SIZE;

  const rsc = RESOURCE_MAP[type] || RESOURCE_MAP.invoices;
  // customers nie mają IssueDate — sortujemy tylko po Id; dokumenty po dacie wystawienia
  const orderby = type === 'customers' ? 'Id desc' : 'IssueDate desc, Id desc';
  const qs = `$orderby=${encodeURIComponent(orderby)}&$skip=${skip}&$top=${PAGE_SIZE}`;
  const url = `${BF_BASE}/api2/public/${rsc.ver}/${rsc.path}?${qs}`;

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
