// ============================================================
//  Finance LogisticFit — Backend: pobranie dokumentu faktury z inFakt
//  GET /api/infakt-pdf?type=sales|cost&id=<id|uuid>
//  Faktury sprzedaży: /invoices/{id}/pdf.json?document_type=original (PDF generowany)
//  Koszty: szczegół /documents/costs/{uuid}.json → attachments[0].file_url (skan/KSeF z S3)
//  Klucz inFakt server-side. Streamuje PDF do przeglądarki.
// ============================================================

const INFAKT_BASE = 'https://api.infakt.pl/api/v3';

module.exports = async function (context, req) {
  const apiKey = process.env.INFAKT_API_KEY;
  if (!apiKey) { context.res = { status: 500, body: 'Brak INFAKT_API_KEY' }; return; }

  const type = (req.query.type || 'sales').toLowerCase();
  const id = req.query.id;
  const attIdx = req.query.att !== undefined ? parseInt(req.query.att, 10) : null;  // koszt: indeks załącznika
  const attId = req.query.attId || null;  // faktura: id załącznika
  if (!id) { context.res = { status: 400, body: 'Brak id' }; return; }

  const H = { 'X-inFakt-ApiKey': apiKey };

  try {
    let pdfBuffer = null;
    let fileName = `dokument-${id}.pdf`;

    if (attId) {
      // Załącznik faktury sprzedaży — pobierz metadane → download_link
      const r = await fetch(`${INFAKT_BASE}/invoices/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attId)}.json`, { headers: { ...H, 'Accept': 'application/json' } });
      if (!r.ok) { context.res = { status: r.status, body: 'inFakt załącznik: ' + (await r.text()).slice(0, 200) }; return; }
      const meta = await r.json();
      const link = meta.download_link || meta.file_url;
      if (!link) { context.res = { status: 404, body: 'Brak download_link załącznika' }; return; }
      fileName = meta.name || fileName;
      const fr = await fetch(link);
      if (!fr.ok) { context.res = { status: 502, body: 'Pobranie załącznika nieudane' }; return; }
      pdfBuffer = Buffer.from(await fr.arrayBuffer());
    } else if (type === 'cost') {
      // Koszt — pobierz szczegół, wyciągnij file_url skanu (domyślnie [0], lub att=N)
      const detRes = await fetch(`${INFAKT_BASE}/documents/costs/${encodeURIComponent(id)}.json`, { headers: { ...H, 'Accept': 'application/json' } });
      if (!detRes.ok) { context.res = { status: detRes.status, body: 'inFakt koszt: ' + (await detRes.text()).slice(0, 200) }; return; }
      const det = await detRes.json();
      const idx = attIdx ?? 0;
      const att = Array.isArray(det.attachments) ? det.attachments[idx] : null;
      if (!att || !att.file_url) { context.res = { status: 404, body: 'Koszt nie ma skanu (idx ' + idx + ')' }; return; }
      fileName = att.file_name || fileName;
      const fileRes = await fetch(att.file_url);
      if (!fileRes.ok) { context.res = { status: 502, body: 'Pobranie skanu S3 nieudane' }; return; }
      pdfBuffer = Buffer.from(await fileRes.arrayBuffer());
    } else {
      // Faktura sprzedaży — PDF generowany przez inFakt
      const res = await fetch(`${INFAKT_BASE}/invoices/${encodeURIComponent(id)}/pdf.json?document_type=original`, { headers: { ...H, 'Accept': 'application/pdf' } });
      if (!res.ok) { context.res = { status: res.status, body: 'inFakt PDF: ' + (await res.text()).slice(0, 200) }; return; }
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/pdf')) {
        pdfBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        const data = await res.json();
        const b64 = data.pdf || data.content || data.data;
        if (!b64) { context.res = { status: 502, body: 'inFakt nie zwrócił PDF' }; return; }
        pdfBuffer = Buffer.from(b64, 'base64');
      }
    }

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName.replace(/[^\w.\-]/g, '_')}"`,
        'Cache-Control': 'private, max-age=300',
      },
      body: pdfBuffer,
      isRaw: true,
    };
  } catch (e) {
    context.res = { status: 500, body: 'Wyjątek serwera: ' + (e.message || String(e)) };
  }
};
