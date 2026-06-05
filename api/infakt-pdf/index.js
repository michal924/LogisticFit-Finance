// ============================================================
//  Finance LogisticFit — Backend: pobranie PDF faktury z inFakt
//  GET /api/infakt-pdf?type=sales|cost&id=<id|uuid>
//  Pobiera PDF server-side (klucz inFakt ukryty) i streamuje do przeglądarki.
//  UWAGA: pobranie PDF faktury w inFakt zmienia jej status na "Wydrukowano".
// ============================================================

const INFAKT_BASE = 'https://api.infakt.pl/api/v3';

module.exports = async function (context, req) {
  const apiKey = process.env.INFAKT_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, body: 'Brak INFAKT_API_KEY' };
    return;
  }

  const type = (req.query.type || 'sales').toLowerCase();
  const id = req.query.id;
  if (!id) { context.res = { status: 400, body: 'Brak id' }; return; }

  // inFakt: faktury → /invoices/{id}/pdf.json, koszty → dokument źródłowy
  // wymaga ?document_type=original (oryginał faktury)
  const path = type === 'cost'
    ? `documents/costs/${encodeURIComponent(id)}/pdf.json`
    : `invoices/${encodeURIComponent(id)}/pdf.json`;
  const url = `${INFAKT_BASE}/${path}?document_type=original`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/pdf' },
    });

    if (!res.ok) {
      const txt = await res.text();
      context.res = { status: res.status, body: 'inFakt PDF: ' + txt.slice(0, 300) };
      return;
    }

    const ctype = res.headers.get('content-type') || '';
    let pdfBuffer;

    if (ctype.includes('application/pdf')) {
      pdfBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      // czasem inFakt zwraca JSON z base64
      const data = await res.json();
      const b64 = data.pdf || data.content || data.data;
      if (!b64) { context.res = { status: 502, body: 'inFakt nie zwrócił PDF' }; return; }
      pdfBuffer = Buffer.from(b64, 'base64');
    }

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="faktura-${id}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
      body: pdfBuffer,
      isRaw: true,
    };
  } catch (e) {
    context.res = { status: 500, body: 'Wyjątek serwera: ' + (e.message || String(e)) };
  }
};
