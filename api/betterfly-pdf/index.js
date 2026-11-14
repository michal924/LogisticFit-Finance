// ============================================================
//  Finance LogisticFit — Backend: PDF faktury z Comarch Betterfly (kontekst SPÓŁKA)
//  GET /api/betterfly-pdf?type=sales|proforma&id=<Id>
//  Betterfly: GET /api2/public/{ver}/{invoices|proformas}/{id}/print
//  → JSON string "data:application/pdf;base64,..." (wydruk generowany przez Betterfly).
//  Koszty (vatpurchasebooks) nie mają wydruku ani załączników w API.
//  Sekrety server-side. Streamuje PDF do przeglądarki.
// ============================================================

const { BF_BASE, bfGet } = require('../shared/betterfly');

const PRINT_RESOURCE = {
  sales:    { path: 'invoices',  ver: 'v1.5' },
  proforma: { path: 'proformas', ver: 'v1.4' },
};

module.exports = async function (context, req) {
  const clientId = process.env.BETTERFLY_CLIENT_ID;
  const clientSecret = process.env.BETTERFLY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    context.res = { status: 500, body: 'Brak BETTERFLY_CLIENT_ID / BETTERFLY_CLIENT_SECRET' };
    return;
  }

  const type = (req.query.type || 'sales').toLowerCase();
  const id = String(req.query.id || '');
  const rsc = PRINT_RESOURCE[type];
  if (!rsc) { context.res = { status: 400, body: 'Nieobsługiwany typ (sales|proforma)' }; return; }
  if (!/^\d+$/.test(id)) { context.res = { status: 400, body: 'Brak lub niepoprawne id' }; return; }

  try {
    const res = await bfGet(`${BF_BASE}/api2/public/${rsc.ver}/${rsc.path}/${id}/print`, clientId, clientSecret);
    if (!res.ok) {
      context.res = { status: res.status, body: 'Betterfly wydruk: ' + (await res.text()).slice(0, 200) };
      return;
    }

    // Odpowiedź to JSON string z data URL; na wszelki wypadek obsługujemy też surowy PDF
    let pdfBuffer;
    const ctype = res.headers.get('content-type') || '';
    if (ctype.includes('application/pdf')) {
      pdfBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      const payload = await res.json();
      const str = typeof payload === 'string' ? payload : (payload.Content || payload.content || payload.data || '');
      const b64 = String(str).replace(/^data:[^,]*,/, '');
      pdfBuffer = Buffer.from(b64, 'base64');
    }
    if (pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
      context.res = { status: 502, body: 'Betterfly nie zwrócił poprawnego PDF' };
      return;
    }

    const fileName = `${type === 'proforma' ? 'proforma' : 'faktura'}-${id}.pdf`;
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300',
      },
      body: pdfBuffer,
      isRaw: true,
    };
  } catch (e) {
    context.res = { status: 500, body: 'Wyjątek serwera: ' + (e.message || String(e)) };
  }
};
