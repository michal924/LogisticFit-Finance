// ============================================================
//  Finance LogisticFit — Backend: dokument faktury z KSeF
//  GET /api/ksef-pdf?ksef=<numer KSeF>[&format=xml]
//  Domyślnie PDF (wizualizacja z kodem QR KOD I), format=xml zwraca oryginalny XML z KSeF.
// ============================================================

const ksef = require('../shared/ksef');
const { renderKsefPdf, parseInvoiceXml } = require('../shared/ksefPdf');

// Numer KSeF: NIP-RRRRMMDD-12 znaków hex-2 znaki hex (np. 5253096205-20261104-9111A1800002-45)
const KSEF_RE = /^\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2}$/i;

module.exports = async function (context, req) {
  const ksefNumber = String(req.query.ksef || '').trim();
  if (!KSEF_RE.test(ksefNumber)) { context.res = { status: 400, body: 'Niepoprawny numer KSeF' }; return; }
  if (!ksef.config()) { context.res = { status: 503, body: 'KSeF nie jest skonfigurowany (KSEF_TOKEN, KSEF_NIP)' }; return; }

  try {
    const xml = await ksef.getInvoiceXml(ksefNumber);
    const safe = ksefNumber.replace(/[^\w-]/g, '_');

    if ((req.query.format || '').toLowerCase() === 'xml') {
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/xml', 'Content-Disposition': `inline; filename="${safe}.xml"`, 'Cache-Control': 'private, max-age=300' },
        body: xml,
        isRaw: true,
      };
      return;
    }

    const fa = parseInvoiceXml(xml);
    const sellerNip = String(fa.Podmiot1?.DaneIdentyfikacyjne?.NIP || ksefNumber.slice(0, 10));
    const pdf = await renderKsefPdf(xml, {
      ksefNumber,
      verificationUrl: ksef.verificationUrl(sellerNip, String(fa.Fa?.P_1 || ''), xml),
    });
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${safe}.pdf"`, 'Cache-Control': 'private, max-age=300' },
      body: pdf,
      isRaw: true,
    };
  } catch (e) {
    context.res = { status: e.status && e.status < 600 ? e.status : 502, body: 'KSeF: ' + (e.message || String(e)) };
  }
};
