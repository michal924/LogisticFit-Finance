// ============================================================
//  Finance LogisticFit — Backend: pobieranie faktur z Comarch Betterfly
//  Używane dla kontekstu SPÓŁKA (JDG korzysta z inFakt — patrz infakt-sync).
//  Sekrety serwer-side: BETTERFLY_CLIENT_ID + BETTERFLY_CLIENT_SECRET.
//  Endpoint: GET /api/betterfly-sync?type=invoices|purchase&page=1[&raw=1]
//  Tylko ODCZYT (GET) — nic nie zapisujemy do Betterfly.
// ============================================================

const { BF_BASE, bfGet } = require('../shared/betterfly');
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
    const res = await bfGet(url, clientId, clientSecret);

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
