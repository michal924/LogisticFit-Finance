// ============================================================
//  Finance LogisticFit — Backend: pobieranie faktur z inFakt
//  Klucz inFakt trzymany SERWER-SIDE (process.env.INFAKT_API_KEY).
//  Endpoint: GET /api/infakt-sync?type=invoices|costs&page=1
//  Zwraca surowe dane z inFakt — frontend zapisuje do SharePoint (upsert po ksef_number).
// ============================================================

const INFAKT_BASE = 'https://api.infakt.pl/api/v3';

module.exports = async function (context, req) {
  const apiKey = process.env.INFAKT_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, body: { error: 'Brak INFAKT_API_KEY w konfiguracji serwera' } };
    return;
  }

  const type = (req.query.type || 'invoices').toLowerCase();   // invoices | costs
  const page = parseInt(req.query.page || '1', 10);
  const limit = 100;
  const offset = (page - 1) * limit;

  // UWAGA: inFakt ma różne ścieżki — faktury /invoices.json, koszty /documents/costs.json
  const path = type === 'costs' ? 'documents/costs' : 'invoices';
  const url = `${INFAKT_BASE}/${path}.json?offset=${offset}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-inFakt-ApiKey': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      context.res = { status: res.status, body: { error: 'inFakt API: ' + txt.slice(0, 400) } };
      return;
    }

    const data = await res.json();
    // inFakt zwraca { entities: [...], metadata: {...} } lub tablicę — normalizujemy
    const items = Array.isArray(data) ? data : (data.entities || data.invoices || data.costs || data.documents || []);
    const metadata = data.metadata || {};

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { type, page, count: items.length, items, metadata },
    };
  } catch (e) {
    context.res = { status: 500, body: { error: 'Wyjątek serwera: ' + (e.message || String(e)) } };
  }
};
