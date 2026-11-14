// ============================================================
//  Finance LogisticFit — Backend: faktury ZAKUPOWE Spółki z KSeF (metadane)
//  GET /api/ksef-sync?from=RRRR-MM-DD&to=RRRR-MM-DD
//  → { configured, invoices: [{ ksefNumber, invoiceNumber, issueDate, sellerNip, sellerName,
//       net, vat, gross, currency, invoiceType }] }
//  Bez konfiguracji (KSEF_TOKEN/KSEF_NIP) zwraca configured:false — frontend wtedy nie oznacza kosztów.
// ============================================================

const ksef = require('../shared/ksef');

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

module.exports = async function (context, req) {
  const json = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
  if (!ksef.config()) return json(200, { configured: false, invoices: [] });

  const today = new Date().toISOString().slice(0, 10);
  const from = req.query.from || '2026-02-01'; // start obowiązkowego KSeF
  const to = req.query.to || today;
  if (!isDate(from) || !isDate(to) || from > to) return json(400, { error: 'Parametry from/to w formacie RRRR-MM-DD' });

  try {
    const rows = await ksef.listPurchaseInvoices(from, to);
    const invoices = rows.map((r) => ({
      ksefNumber: r.ksefNumber,
      invoiceNumber: r.invoiceNumber,
      issueDate: String(r.issueDate || '').slice(0, 10),
      sellerNip: r.seller?.nip || '',
      sellerName: r.seller?.name || '',
      net: r.netAmount,
      vat: r.vatAmount,
      gross: r.grossAmount,
      currency: r.currency,
      invoiceType: r.invoiceType,
    }));
    json(200, { configured: true, from, to, count: invoices.length, invoices });
  } catch (e) {
    json(e.status && e.status < 600 ? e.status : 502, { error: e.message || String(e) });
  }
};
