// ============================================================
//  Finance LogisticFit — Backend: dane podatkowe z inFakt (JPK_V7, PIT, VAT-UE).
//  GET /api/infakt-tax?type=saf_v7|income|vat_eu&page=1          → lista
//  GET /api/infakt-tax?type=saf_v7&id=123                        → szczegół
//  Klucz inFakt server-side. Tylko odczyt (allowlista endpointów).
// ============================================================

const INFAKT_BASE = 'https://api.infakt.pl/api/v3';

// allowlista: alias → ścieżka zasobu inFakt
const RESOURCES = {
  saf_v7: 'saf_v7_files',     // JPK_V7
  income: 'income_taxes',     // podatek dochodowy (PIT)
  vat_eu: 'vat_eu_taxes',     // VAT-UE
  books: 'books',             // KPiR (księga przychodów i rozchodów)
  insurance: 'insurance_fees',// ZUS
};

module.exports = async function (context, req) {
  const apiKey = process.env.INFAKT_API_KEY;
  if (!apiKey) { context.res = { status: 500, body: { error: 'Brak INFAKT_API_KEY' } }; return; }

  const type = (req.query.type || 'saf_v7').toLowerCase();
  const resource = RESOURCES[type];
  if (!resource) { context.res = { status: 400, body: { error: 'Nieznany typ: ' + type } }; return; }

  const id = req.query.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = 100;
  const offset = (page - 1) * limit;

  const url = id
    ? `${INFAKT_BASE}/${resource}/${encodeURIComponent(id)}.json`
    : `${INFAKT_BASE}/${resource}.json?offset=${offset}&limit=${limit}`;

  try {
    const res = await fetch(url, { method: 'GET', headers: { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/json' } });
    if (!res.ok) {
      const txt = await res.text();
      context.res = { status: res.status, body: { error: 'inFakt API: ' + txt.slice(0, 400) } };
      return;
    }
    const data = await res.json();
    if (id) {
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { type, item: data } };
      return;
    }
    const items = Array.isArray(data) ? data : (data.entities || data[resource] || []);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { type, page, count: items.length, items, metadata: data.metadata || {} },
    };
  } catch (e) {
    context.res = { status: 500, body: { error: 'Wyjątek serwera: ' + (e.message || String(e)) } };
  }
};
