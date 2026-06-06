import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { robotoRegularBase64 } from './robotoFont';

const NAVY = [58, 77, 152] as [number, number, number];
const SLATE = [120, 128, 150] as [number, number, number];

function money(n: number): string {
  return (n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface RegLine { number: string; date: string; name: string; nip: string; net: number; vat: number; gross?: number; }
export interface ReportParams {
  company: { name: string; taxid: string; address: string };
  periodName: string;          // np. "Styczeń 2026"
  summary: {
    income: number; expenses: number; profit: number;
    vatNal: number; vatNacz: number; vatDue: number;
    pitDue: number; zus: number;
  };
  salesReg: RegLine[];
  costReg: RegLine[];
}

function registerFont(doc: jsPDF) {
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegularBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
}

export function generateMonthlyReport(p: ReportParams): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  registerFont(doc);
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // Nagłówek
  doc.setFontSize(18); doc.setTextColor(...NAVY);
  doc.text('Raport miesięczny', M, 52);
  doc.setFontSize(13); doc.setTextColor(40, 40, 40);
  doc.text(p.periodName, M, 72);

  doc.setFontSize(9); doc.setTextColor(...SLATE);
  doc.text(p.company.name, W - M, 46, { align: 'right' });
  doc.text(`NIP ${p.company.taxid}`, W - M, 58, { align: 'right' });
  doc.text(p.company.address, W - M, 70, { align: 'right' });

  doc.setDrawColor(225, 228, 238); doc.line(M, 84, W - M, 84);

  // Podsumowanie
  autoTable(doc, {
    startY: 98,
    head: [['Podsumowanie', 'Kwota (PLN)']],
    body: [
      ['Przychód (KPiR)', money(p.summary.income)],
      ['Koszty (KPiR)', money(p.summary.expenses)],
      ['Dochód', money(p.summary.profit)],
      ['VAT należny (sprzedaż)', money(p.summary.vatNal)],
      ['VAT naliczony (zakupy)', money(p.summary.vatNacz)],
      ['VAT do zapłaty (JPK_V7)', money(p.summary.vatDue)],
      ['Zaliczka PIT', money(p.summary.pitDue)],
      ['ZUS', money(p.summary.zus)],
    ],
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: NAVY, textColor: 255, font: 'Roboto' },
    columnStyles: { 1: { halign: 'right', cellWidth: 120 } },
    margin: { left: M, right: M },
  });

  // Rejestr sprzedaży VAT
  const sNet = p.salesReg.reduce((s, r) => s + r.net, 0);
  const sVat = p.salesReg.reduce((s, r) => s + r.vat, 0);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [['Rejestr sprzedaży VAT', '', '', '', '', '']],
    body: [],
    theme: 'plain',
    styles: { font: 'Roboto', fontSize: 11, textColor: NAVY, fontStyle: 'normal' },
    margin: { left: M, right: M },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    head: [['Lp', 'Nr faktury', 'Data', 'Nabywca', 'NIP', 'Netto', 'VAT']],
    body: p.salesReg.length
      ? p.salesReg.map((r, i) => [String(i + 1), r.number, r.date, r.name, r.nip, money(r.net), money(r.vat)])
      : [['—', 'Brak faktur sprzedaży', '', '', '', '', '']],
    foot: p.salesReg.length ? [['', '', '', '', 'Suma', money(sNet), money(sVat)]] : undefined,
    theme: 'striped',
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: NAVY, textColor: 255, font: 'Roboto', fontSize: 8 },
    footStyles: { fillColor: [240, 242, 248], textColor: 20, font: 'Roboto', fontStyle: 'normal' },
    columnStyles: { 0: { cellWidth: 24 }, 4: { cellWidth: 78 }, 5: { halign: 'right', cellWidth: 62 }, 6: { halign: 'right', cellWidth: 56 } },
    margin: { left: M, right: M },
  });

  // Rejestr zakupów VAT
  const cNet = p.costReg.reduce((s, r) => s + r.net, 0);
  const cVat = p.costReg.reduce((s, r) => s + r.vat, 0);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [['Rejestr zakupów VAT']],
    body: [],
    theme: 'plain',
    styles: { font: 'Roboto', fontSize: 11, textColor: NAVY },
    margin: { left: M, right: M },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    head: [['Lp', 'Nr dowodu', 'Data', 'Kontrahent', 'NIP', 'Netto', 'VAT']],
    body: p.costReg.length
      ? p.costReg.map((r, i) => [String(i + 1), r.number, r.date, r.name, r.nip, money(r.net), money(r.vat)])
      : [['—', 'Brak faktur kosztowych', '', '', '', '', '']],
    foot: p.costReg.length ? [['', '', '', '', 'Suma', money(cNet), money(cVat)]] : undefined,
    theme: 'striped',
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: NAVY, textColor: 255, font: 'Roboto', fontSize: 8 },
    footStyles: { fillColor: [240, 242, 248], textColor: 20, font: 'Roboto', fontStyle: 'normal' },
    columnStyles: { 0: { cellWidth: 24 }, 4: { cellWidth: 78 }, 5: { halign: 'right', cellWidth: 62 }, 6: { halign: 'right', cellWidth: 56 } },
    margin: { left: M, right: M },
  });

  // Stopka na każdej stronie
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(...SLATE);
    doc.text('Raport wygenerowany przez LogisticFit Finance na podstawie danych z inFakt. Dokument pomocniczy.', M, doc.internal.pageSize.getHeight() - 24);
    doc.text(`${i} / ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: 'right' });
  }

  return doc;
}
