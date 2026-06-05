// DIAGNOSTYKA (tymczasowa) — bada strukturę skanu kosztu + załączników faktur.
// GET /api/infakt-probe
const INFAKT_BASE = 'https://api.infakt.pl/api/v3';

module.exports = async function (context, req) {
  const apiKey = process.env.INFAKT_API_KEY;
  if (!apiKey) { context.res = { status: 500, body: { error: 'Brak INFAKT_API_KEY' } }; return; }
  const H = { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/json' };
  const out = {};

  async function gj(url) {
    try {
      const r = await fetch(url, { headers: H });
      const t = await r.text();
      try { return { status: r.status, json: JSON.parse(t) }; }
      catch { return { status: r.status, raw: t.slice(0, 300) }; }
    } catch (e) { return { error: e.message }; }
  }

  try {
    // 1. Pierwsza faktura — pobierz uuid, potem jej załączniki
    const inv = await gj(`${INFAKT_BASE}/invoices.json?limit=1`);
    const invItem = inv.json?.entities?.[0] || inv.json?.invoices?.[0];
    out.invoiceSample = invItem ? { id: invItem.id, uuid: invItem.uuid, number: invItem.number } : inv;
    if (invItem?.uuid) {
      out.invoiceAttachments = await gj(`${INFAKT_BASE}/invoices/${invItem.uuid}/attachments.json`);
    }

    // 2. Pierwszy koszt — pobierz uuid, potem szczegół (szukamy linku do skanu)
    const cost = await gj(`${INFAKT_BASE}/documents/costs.json?limit=1`);
    const costItem = cost.json?.entities?.[0] || cost.json?.costs?.[0];
    out.costSample = costItem ? { uuid: costItem.uuid, number: costItem.number } : cost;
    if (costItem?.uuid) {
      out.costDetail = await gj(`${INFAKT_BASE}/documents/costs/${costItem.uuid}.json`);
      out.costAttachments = await gj(`${INFAKT_BASE}/documents/costs/${costItem.uuid}/attachments.json`);
    }

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: out };
  } catch (e) {
    context.res = { status: 500, body: { error: e.message } };
  }
};
