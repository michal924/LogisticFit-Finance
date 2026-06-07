import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { robotoRegularBase64 } from './robotoFont';

const NAVY = rgb(58 / 255, 77 / 255, 152 / 255);
const GREEN = rgb(35 / 255, 157 / 255, 70 / 255);
const DARK = rgb(0.08, 0.09, 0.12);
const GREY = rgb(0.45, 0.48, 0.55);
const LINE = rgb(0.88, 0.89, 0.93);
const STRIPE = rgb(0.97, 0.975, 0.985);

function money(n: number): string {
  return (n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface RegLine { number: string; date: string; name: string; nip: string; net: number; vat: number; gross?: number; }
export interface ReportParams {
  company: { name: string; taxid: string; address: string };
  periodName: string;
  summary: { income: number; expenses: number; profit: number; vatNal: number; vatNacz: number; vatDue: number; pitDue: number; zus: number; };
  salesReg: RegLine[];
  costReg: RegLine[];
}

interface Col { x: number; w: number; align?: 'left' | 'right'; }

export async function generateMonthlyReport(p: ReportParams): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(b64ToBytes(robotoRegularBase64), { subset: true });

  const PW = 595.28, PH = 841.89, M = 40;
  let page: PDFPage = pdf.addPage([PW, PH]);
  let y = PH - M;

  const text = (s: string, x: number, yy: number, size: number, color = DARK, align: 'left' | 'right' = 'left') => {
    let xx = x;
    if (align === 'right') xx = x - font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: xx, y: yy, size, font, color });
  };
  const truncate = (s: string, size: number, maxW: number): string => {
    s = s || '';
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    while (s.length && font.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
    return s + '…';
  };
  const ensure = (need: number) => { if (y - need < M + 28) { page = pdf.addPage([PW, PH]); y = PH - M; } };

  // Nagłówek
  text('Raport miesięczny', M, y - 6, 18, NAVY);
  text(p.periodName, M, y - 26, 13, DARK);
  text(p.company.name, PW - M, y - 4, 9, GREY, 'right');
  text(`NIP ${p.company.taxid}`, PW - M, y - 16, 9, GREY, 'right');
  if (p.company.address) text(truncate(p.company.address, 9, 240), PW - M, y - 28, 9, GREY, 'right');
  y -= 44;
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: LINE });
  y -= 22;

  // Sekcja: tytuł
  const sectionTitle = (t: string) => { ensure(28); text(t, M, y, 12, NAVY); y -= 16; };

  // Tabela z paginacją (nagłówek powtarzany na nowej stronie)
  const drawTable = (cols: Col[], header: string[], rows: string[][], foot?: string[]) => {
    const rh = 16, hdrH = 18, size = 8;
    const newPage = () => { page = pdf.addPage([PW, PH]); y = PH - M; };
    const drawHeader = () => {
      page.drawRectangle({ x: M, y: y - hdrH + 4, width: PW - 2 * M, height: hdrH, color: NAVY });
      header.forEach((h, i) => text(h, cols[i].align === 'right' ? cols[i].x + cols[i].w - 4 : cols[i].x + 4, y - hdrH + 9, size, rgb(1, 1, 1), cols[i].align));
      y -= hdrH;
    };
    if (y - (hdrH + rh) < M + 28) newPage();
    drawHeader();
    rows.forEach((r, ri) => {
      if (y - rh < M + 28) { newPage(); drawHeader(); }
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - rh + 3, width: PW - 2 * M, height: rh, color: STRIPE });
      r.forEach((c, i) => {
        const col = cols[i];
        const val = col.align === 'right' ? c : truncate(c, size, col.w - 6);
        text(val, col.align === 'right' ? col.x + col.w - 4 : col.x + 4, y - rh + 8, size, DARK, col.align);
      });
      y -= rh;
    });
    if (foot) {
      if (y - rh < M + 28) { newPage(); drawHeader(); }
      page.drawRectangle({ x: M, y: y - rh + 3, width: PW - 2 * M, height: rh, color: rgb(0.94, 0.95, 0.97) });
      foot.forEach((c, i) => text(c, cols[i].align === 'right' ? cols[i].x + cols[i].w - 4 : cols[i].x + 4, y - rh + 8, size, DARK, cols[i].align));
      y -= rh;
    }
    y -= 6;
  };

  // 1. Podsumowanie
  sectionTitle('Podsumowanie');
  const sumCols: Col[] = [{ x: M, w: 320 }, { x: M + 320, w: PW - 2 * M - 320, align: 'right' }];
  drawTable(sumCols, ['Pozycja', 'Kwota (PLN)'], [
    ['Przychód (KPiR)', money(p.summary.income)],
    ['Koszty (KPiR)', money(p.summary.expenses)],
    ['Dochód', money(p.summary.profit)],
    ['VAT należny (sprzedaż)', money(p.summary.vatNal)],
    ['VAT naliczony (zakupy)', money(p.summary.vatNacz)],
    ['VAT do zapłaty (JPK_V7)', money(p.summary.vatDue)],
    ['Zaliczka PIT', money(p.summary.pitDue)],
    ['ZUS', money(p.summary.zus)],
  ]);
  y -= 8;

  // Kolumny rejestrów
  const c0 = M;
  const regCols: Col[] = [
    { x: c0, w: 26 },                 // Lp
    { x: c0 + 26, w: 96 },            // Nr
    { x: c0 + 122, w: 58 },           // Data
    { x: c0 + 180, w: 150 },          // Kontrahent
    { x: c0 + 330, w: 75 },           // NIP
    { x: c0 + 405, w: 58, align: 'right' as const }, // Netto
    { x: c0 + 463, w: 52, align: 'right' as const }, // VAT
  ];

  // 2. Rejestr sprzedaży VAT
  sectionTitle('Rejestr sprzedaży VAT');
  {
    const sNet = p.salesReg.reduce((s, r) => s + r.net, 0), sVat = p.salesReg.reduce((s, r) => s + r.vat, 0);
    const rows = p.salesReg.length
      ? p.salesReg.map((r, i) => [String(i + 1), r.number, r.date, r.name, r.nip, money(r.net), money(r.vat)])
      : [['—', 'Brak faktur sprzedaży', '', '', '', '', '']];
    drawTable(regCols, ['Lp', 'Nr faktury', 'Data', 'Nabywca', 'NIP', 'Netto', 'VAT'], rows,
      p.salesReg.length ? ['', '', '', '', 'Suma', money(sNet), money(sVat)] : undefined);
  }
  y -= 8;

  // 3. Rejestr zakupów VAT
  sectionTitle('Rejestr zakupów VAT');
  {
    const cNet = p.costReg.reduce((s, r) => s + r.net, 0), cVat = p.costReg.reduce((s, r) => s + r.vat, 0);
    const rows = p.costReg.length
      ? p.costReg.map((r, i) => [String(i + 1), r.number, r.date, r.name, r.nip, money(r.net), money(r.vat)])
      : [['—', 'Brak faktur kosztowych', '', '', '', '', '']];
    drawTable(regCols, ['Lp', 'Nr dowodu', 'Data', 'Kontrahent', 'NIP', 'Netto', 'VAT'], rows,
      p.costReg.length ? ['', '', '', '', 'Suma', money(cNet), money(cVat)] : undefined);
  }

  // Stopka na każdej stronie
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    pg.drawText('Raport pomocniczy wygenerowany przez LogisticFit Finance na podstawie danych z inFakt.', { x: M, y: 24, size: 7.5, font, color: GREY });
    pg.drawText(`${i + 1} / ${pages.length}`, { x: PW - M - 24, y: 24, size: 7.5, font, color: GREY });
  });

  // sygnatura koloru (unused import guard)
  void GREEN;

  return await pdf.save();
}
