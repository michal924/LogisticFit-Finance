// ============================================================
//  Finance LogisticFit — Backend: manifest dokumentów faktury z inFakt
//  GET /api/infakt-manifest?type=sales|cost&id=<id>&uuid=<uuid>
//  Zwraca listę WSZYSTKICH dokumentów do archiwizacji (główny + załączniki):
//  { documents: [{ name, url }] } — url to /api/infakt-pdf?... do pobrania pliku.
// ============================================================

const INFAKT_BASE = 'https://api.infakt.pl/api/v3';

module.exports = async function (context, req) {
  const apiKey = process.env.INFAKT_API_KEY;
  if (!apiKey) { context.res = { status: 500, body: { error: 'Brak INFAKT_API_KEY' } }; return; }

  const type = (req.query.type || 'sales').toLowerCase();
  const id = req.query.id;
  const uuid = req.query.uuid || id;
  if (!id) { context.res = { status: 400, body: { error: 'Brak id' } }; return; }

  const H = { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/json' };
  const documents = [];

  try {
    if (type === 'cost') {
      // Koszt — wszystkie attachments[] ze szczegółu
      const r = await fetch(`${INFAKT_BASE}/documents/costs/${encodeURIComponent(uuid)}.json`, { headers: H });
      if (r.ok) {
        const det = await r.json();
        const atts = Array.isArray(det.attachments) ? det.attachments : [];
        atts.forEach((a, idx) => {
          documents.push({
            name: a.file_name || `koszt-${uuid}-${idx}.pdf`,
            url: `/api/infakt-pdf?type=cost&id=${encodeURIComponent(uuid)}&att=${idx}`,
          });
        });
      }
    } else {
      // Faktura sprzedaży — główny PDF generowany
      documents.push({
        name: `faktura-${id}.pdf`,
        url: `/api/infakt-pdf?type=sales&id=${encodeURIComponent(id)}`,
      });
      // + załączniki (jeśli są)
      const r = await fetch(`${INFAKT_BASE}/invoices/${encodeURIComponent(uuid)}/attachments.json?limit=100`, { headers: H });
      if (r.ok) {
        const data = await r.json();
        const ents = data.entities || [];
        ents.forEach((a) => {
          documents.push({
            name: a.name || `zalacznik-${a.id}.pdf`,
            url: `/api/infakt-pdf?type=sales&id=${encodeURIComponent(uuid)}&attId=${encodeURIComponent(a.id)}`,
          });
        });
      }
    }

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { count: documents.length, documents } };
  } catch (e) {
    context.res = { status: 500, body: { error: e.message || String(e) } };
  }
};
