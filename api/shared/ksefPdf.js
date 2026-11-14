// ============================================================
//  Wizualizacja PDF faktury ustrukturyzowanej KSeF (schemat FA(2)/FA(3)).
//  Wejście: XML z KSeF, numer KSeF, link weryfikacyjny (KOD I).
//  Wyjście: Buffer z PDF (A4, Roboto z polskimi znakami, kod QR z numerem KSeF).
//  Dokumentem w sensie prawnym jest XML w KSeF; PDF to jego czytelny wydruk.
// ============================================================

const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const QRCode = require('qrcode');
const { XMLParser } = require('fast-xml-parser');
const robotoTtf = require('./robotoFont');

const ARRAYS = new Set(['FaWiersz', 'TerminPlatnosci', 'RachunekBankowy', 'DodatkowyOpis', 'Podmiot3', 'DaneFaKorygowanej', 'ZaliczkaCzesciowa']);

function parseInvoiceXml(xml) {
  const parser = new XMLParser({
    removeNSPrefix: true,
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => ARRAYS.has(name),
  });
  const doc = parser.parse(xml.toString('utf8'));
  if (!doc.Faktura) throw new Error('XML nie jest fakturą KSeF (brak elementu Faktura)');
  return doc.Faktura;
}

const KIND = {
  VAT: 'Faktura VAT', KOR: 'Faktura korygująca', ZAL: 'Faktura zaliczkowa', ROZ: 'Faktura rozliczeniowa',
  UPR: 'Faktura uproszczona', KOR_ZAL: 'Faktura korygująca zaliczkową', KOR_ROZ: 'Faktura korygująca rozliczeniową',
};
const PAYMENT_FORM = { 1: 'Gotówka', 2: 'Karta', 3: 'Bon', 4: 'Czek', 5: 'Kredyt', 6: 'Przelew', 7: 'Płatność mobilna' };
// Pola sum wg stawek: [netto, VAT, etykieta]
const RATE_FIELDS = [
  ['P_13_1', 'P_14_1', '23% / 22%'], ['P_13_2', 'P_14_2', '8% / 7%'], ['P_13_3', 'P_14_3', '5%'],
  ['P_13_4', 'P_14_4', 'ryczałt taxi'], ['P_13_5', 'P_14_5', 'OSS'], ['P_13_6_1', null, '0% (kraj)'],
  ['P_13_6_2', null, '0% (WDT)'], ['P_13_6_3', null, '0% (eksport)'], ['P_13_7', null, 'zw'],
  ['P_13_8', null, 'np (poza krajem)'], ['P_13_9', null, 'np (art. 100)'], ['P_13_10', null, 'odwrotne obciążenie'],
  ['P_13_11', null, 'marża'],
];

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const money = (v) => {
  const n = num(v);
  return n === null ? '' : n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const qty = (v) => {
  const n = num(v);
  return n === null ? '' : n.toLocaleString('pl-PL', { maximumFractionDigits: 6 });
};
const text = (v) => (v === undefined || v === null ? '' : String(v));
const rateLabel = (v) => {
  const s = text(v);
  return /^\d+$/.test(s) ? `${s}%` : s;
};

function party(p) {
  if (!p) return { lines: [] };
  const id = p.DaneIdentyfikacyjne || {};
  const adr = p.Adres || {};
  const nip = id.NIP ? `NIP: ${id.NIP}` : (id.NrVatUE ? `VAT UE: ${id.KodUE || ''}${id.NrVatUE}` : (id.NrID ? `ID: ${id.NrID}` : ''));
  return {
    lines: [text(id.Nazwa), text(adr.AdresL1), text(adr.AdresL2), adr.KodKraju && adr.KodKraju !== 'PL' ? text(adr.KodKraju) : '', nip]
      .filter(Boolean),
  };
}

/**
 * Buduje PDF faktury KSeF.
 * @param {Buffer} xml
 * @param {{ ksefNumber: string, verificationUrl: string }} meta
 */
async function renderKsefPdf(xml, meta) {
  const f = parseInvoiceXml(xml);
  const fa = f.Fa || {};
  const currency = text(fa.KodWaluty) || 'PLN';

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(robotoTtf, { subset: true });
  pdf.setTitle(`${KIND[fa.RodzajFaktury] || 'Faktura'} ${text(fa.P_2)}`);
  pdf.setCreator('LogisticFit Finance (wizualizacja KSeF)');

  const W = 595.28, H = 841.89, M = 40;
  const ink = rgb(0.12, 0.14, 0.2), muted = rgb(0.42, 0.45, 0.52), line = rgb(0.82, 0.84, 0.88);
  let page, y;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const width = (s, size) => font.widthOfTextAtSize(s, size);
  const draw = (s, x, yy, size = 9, color = ink) => page.drawText(s, { x, y: yy, size, font, color });
  const drawRight = (s, xRight, yy, size = 9, color = ink) => draw(s, xRight - width(s, size), yy, size, color);
  const wrap = (s, maxW, size) => {
    const out = [];
    for (const para of text(s).split(/\r?\n/)) {
      let cur = '';
      for (const word of para.split(/\s+/)) {
        const next = cur ? `${cur} ${word}` : word;
        if (width(next, size) <= maxW) { cur = next; continue; }
        if (cur) out.push(cur);
        // bardzo długie słowo (np. numer konta) — tnij po znakach
        let w = word;
        while (width(w, size) > maxW) {
          let i = w.length;
          while (i > 1 && width(w.slice(0, i), size) > maxW) i--;
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        cur = w;
      }
      out.push(cur);
    }
    return out;
  };
  const ensure = (needed) => { if (y - needed < M + 20) newPage(); };
  const hr = () => { page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: line }); };

  newPage();

  // --- Nagłówek
  draw(KIND[fa.RodzajFaktury] || 'Faktura', M, y - 18, 20);
  drawRight(`Numer: ${text(fa.P_2)}`, W - M, y - 8, 11);
  const dates = [
    `Data wystawienia: ${text(fa.P_1)}${fa.P_1M ? `, ${text(fa.P_1M)}` : ''}`,
    fa.P_6 ? `Data dostawy/wykonania usługi: ${text(fa.P_6)}` : '',
    `Numer KSeF: ${meta.ksefNumber}`,
  ].filter(Boolean);
  dates.forEach((d, i) => drawRight(d, W - M, y - 24 - i * 12, 8.5, muted));
  y -= 24 + dates.length * 12 + 6;
  hr();
  y -= 16;

  // --- Strony
  const colW = (W - 2 * M - 20) / 2;
  const parties = [['Sprzedawca', party(f.Podmiot1)], ['Nabywca', party(f.Podmiot2)]];
  let maxRows = 0;
  parties.forEach(([label, p], i) => {
    const x = M + i * (colW + 20);
    draw(label, x, y, 10);
    let yy = y - 14;
    for (const l of p.lines) for (const w of wrap(l, colW, 8.5)) { draw(w, x, yy, 8.5); yy -= 11; }
    maxRows = Math.max(maxRows, y - yy);
  });
  y -= maxRows + 8;
  for (const p3 of f.Podmiot3 || []) {
    const pr = party(p3);
    if (!pr.lines.length) continue;
    ensure(14 + pr.lines.length * 11);
    draw('Podmiot trzeci', M, y, 9, muted);
    y -= 12;
    for (const l of pr.lines) for (const w of wrap(l, W - 2 * M, 8.5)) { draw(w, M, y, 8.5); y -= 11; }
    y -= 4;
  }

  // --- Korekta
  if (String(fa.RodzajFaktury || '').startsWith('KOR')) {
    const corrected = (fa.DaneFaKorygowanej || []).map((d) => `${text(d.NrFaKorygowanej)} z ${text(d.DataWystFaKorygowanej)}${d.NrKSeFFaKorygowanej ? ` (KSeF ${text(d.NrKSeFFaKorygowanej)})` : ''}`);
    const lines = [corrected.length ? `Korygowana faktura: ${corrected.join('; ')}` : '', fa.PrzyczynaKorekty ? `Przyczyna korekty: ${text(fa.PrzyczynaKorekty)}` : ''].filter(Boolean);
    for (const l of lines) for (const w of wrap(l, W - 2 * M, 8.5)) { ensure(12); draw(w, M, y, 8.5); y -= 11; }
    y -= 4;
  }

  // --- Pozycje
  const rows = fa.FaWiersz || [];
  const grossMode = rows.length > 0 && rows.every((r) => r.P_11 === undefined && r.P_11A !== undefined);
  const cols = [
    { h: 'Lp.', w: 24, a: 'l' }, { h: 'Nazwa towaru/usługi', w: 0, a: 'l' }, { h: 'J.m.', w: 34, a: 'l' },
    { h: 'Ilość', w: 50, a: 'r' }, { h: grossMode ? 'Cena brutto' : 'Cena netto', w: 66, a: 'r' },
    { h: 'VAT', w: 34, a: 'r' }, { h: grossMode ? 'Wartość brutto' : 'Wartość netto', w: 74, a: 'r' },
  ];
  cols[1].w = W - 2 * M - cols.reduce((s, c) => s + c.w, 0);
  const colX = []; cols.reduce((x, c) => { colX.push(x); return x + c.w; }, M);
  const header = () => {
    ensure(30);
    y -= 6;
    cols.forEach((c, i) => (c.a === 'r' ? drawRight(c.h, colX[i] + c.w - 2, y, 8, muted) : draw(c.h, colX[i] + 2, y, 8, muted)));
    y -= 6; hr(); y -= 12;
  };
  header();
  rows.forEach((r, idx) => {
    const name = wrap(text(r.P_7) || '—', cols[1].w - 6, 8.5);
    const h = Math.max(1, name.length) * 11 + 4;
    if (y - h < M + 20) { newPage(); header(); }
    const vals = [
      text(r.NrWierszaFa || idx + 1), null, text(r.P_8A), qty(r.P_8B),
      money(grossMode ? r.P_9B : (r.P_9A ?? r.P_9B)), rateLabel(r.P_12), money(grossMode ? r.P_11A : (r.P_11 ?? r.P_11A)),
    ];
    vals.forEach((v, i) => {
      if (i === 1) return;
      cols[i].a === 'r' ? drawRight(v, colX[i] + cols[i].w - 2, y, 8.5) : draw(v, colX[i] + 2, y, 8.5);
    });
    name.forEach((l, i) => draw(l, colX[1] + 2, y - i * 11, 8.5));
    y -= h;
    page.drawLine({ start: { x: M, y: y + 7 }, end: { x: W - M, y: y + 7 }, thickness: 0.3, color: line });
  });
  y -= 6;

  // --- Podsumowanie stawek
  const summary = RATE_FIELDS
    .map(([n, v, label]) => ({ label, net: num(fa[n]), vat: v ? num(fa[v]) : null }))
    .filter((s) => s.net !== null || s.vat !== null);
  const sx = W - M - 270;
  ensure(40 + summary.length * 12);
  draw('Stawka', sx, y, 8, muted); drawRight('Netto', sx + 150, y, 8, muted);
  drawRight('VAT', sx + 210, y, 8, muted); drawRight('Brutto', sx + 270, y, 8, muted);
  y -= 12;
  for (const s of summary) {
    draw(s.label, sx, y, 8.5);
    drawRight(money(s.net), sx + 150, y, 8.5);
    drawRight(s.vat === null ? '' : money(s.vat), sx + 210, y, 8.5);
    drawRight(money((s.net || 0) + (s.vat || 0)), sx + 270, y, 8.5);
    y -= 12;
  }
  y -= 8;
  ensure(30);
  drawRight(`Razem do zapłaty: ${money(fa.P_15)} ${currency}`, W - M, y, 14);
  y -= 22;

  // --- Płatność i adnotacje
  const pay = fa.Platnosc || {};
  const info = [];
  if (pay.Zaplacono === '1') info.push(`Zapłacono${pay.DataZaplaty ? ` ${text(pay.DataZaplaty)}` : ''}`);
  for (const t of pay.TerminPlatnosci || []) if (t.Termin) info.push(`Termin płatności: ${text(t.Termin)}`);
  if (pay.FormaPlatnosci) info.push(`Forma płatności: ${PAYMENT_FORM[pay.FormaPlatnosci] || text(pay.FormaPlatnosci)}`);
  for (const rb of pay.RachunekBankowy || []) {
    info.push(`Rachunek: ${text(rb.NrRB)}${rb.NazwaBanku ? ` (${text(rb.NazwaBanku)})` : ''}`);
  }
  const adn = fa.Adnotacje || {};
  if (adn.P_16 === '1') info.push('Metoda kasowa');
  if (adn.P_17 === '1') info.push('Samofakturowanie');
  if (adn.P_18 === '1') info.push('Odwrotne obciążenie');
  if (adn.P_18A === '1') info.push('Mechanizm podzielonej płatności');
  for (const d of fa.DodatkowyOpis || []) info.push(`${text(d.Klucz)}: ${text(d.Wartosc)}`);
  for (const l of info) for (const w of wrap(l, W - 2 * M, 8.5)) { ensure(12); draw(w, M, y, 8.5); y -= 11; }
  if (f.Stopka?.Informacje?.StopkaFaktury) {
    y -= 4;
    for (const w of wrap(text(f.Stopka.Informacje.StopkaFaktury), W - 2 * M, 8)) { ensure(11); draw(w, M, y, 8, muted); y -= 10; }
  }

  // --- KOD I (weryfikacja w KSeF)
  const qrSize = 96;
  ensure(qrSize + 40);
  y -= 10;
  draw('Sprawdź fakturę w KSeF', M, y, 10);
  y -= 8;
  const qr = QRCode.create(meta.verificationUrl, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size, cell = qrSize / n, top = y;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.modules.get(r, c)) page.drawRectangle({ x: M + c * cell, y: top - (r + 1) * cell, width: cell, height: cell, color: rgb(0, 0, 0) });
  }
  draw(meta.ksefNumber, M, top - qrSize - 11, 7.5);
  const tx = M + qrSize + 14;
  let ty = top - 10;
  for (const w of wrap(meta.verificationUrl, W - M - tx, 7.5)) { draw(w, tx, ty, 7.5, rgb(0.15, 0.3, 0.7)); ty -= 10; }

  // --- Stopki stron
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText('Wizualizacja faktury z KSeF wygenerowana w LogisticFit Finance. Dokumentem źródłowym jest plik XML w KSeF.',
      { x: M, y: 22, size: 7, font, color: muted });
    const s = `Strona ${i + 1} z ${pages.length}`;
    p.drawText(s, { x: W - M - width(s, 7), y: 22, size: 7, font, color: muted });
  });

  return Buffer.from(await pdf.save());
}

module.exports = { renderKsefPdf, parseInvoiceXml };
