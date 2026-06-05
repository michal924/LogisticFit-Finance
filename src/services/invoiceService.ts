import type { Invoice } from '../types';
import { InvoicesService } from './graphService';

// Mapowanie SharePoint → Invoice
function spToInvoice(item: any): Invoice {
  const f = item.fields;
  return {
    spId: item.id,
    id: item.id,
    type: f.InvoiceType || 'cost',
    number: f.InvoiceNumber || '',
    issueDate: f.IssueDate?.split('T')[0] || '',
    dueDate: f.DueDate?.split('T')[0] || '',
    counterparty: f.Counterparty || '',
    nip: f.NIP || '',
    lines: (() => { try { return JSON.parse(f.Lines || '[]'); } catch { return []; } })(),
    netTotal: f.NetTotal || 0,
    vatTotal: f.VatTotal || 0,
    grossTotal: f.GrossTotal || 0,
    currency: f.Currency || 'PLN',
    paid: f.Paid || false,
    notes: f.Notes || '',
    fileUrl: f.FileUrl || '',
    attachments: (() => { try { return JSON.parse(f.DocLinks || '[]'); } catch { return []; } })(),
  };
}

// Mapowanie Invoice → SharePoint fields
function invoiceToSp(inv: Invoice, context?: string) {
  return {
    InvoiceNumber: inv.number,
    IssueDate: inv.issueDate,
    DueDate: inv.dueDate,
    Counterparty: inv.counterparty,
    NIP: inv.nip,
    NetTotal: inv.netTotal,
    VatTotal: inv.vatTotal,
    GrossTotal: inv.grossTotal,
    Currency: inv.currency,
    InvoiceType: inv.type,
    Paid: inv.paid,
    Lines: JSON.stringify(inv.lines || []),
    Notes: inv.notes || '',
    ...(context ? { Context: context } : {}),
    ...(inv.fileUrl ? { FileUrl: inv.fileUrl } : {}),
    ...(inv.attachments?.length ? { DocLinks: JSON.stringify(inv.attachments) } : {}),
  };
}

// context: 'jdg' | 'spolka' — filtruje faktury per działalność (stare rekordy bez Context = jdg)
export async function getInvoices(type: 'sales' | 'cost', context: string = 'jdg'): Promise<Invoice[]> {
  const items = await InvoicesService.getAll();
  return items
    .filter((i: any) => (i.fields?.Context || 'jdg') === context)
    .map((i: any) => spToInvoice(i))
    .filter((i: Invoice) => i.type === type)
    .sort((a: Invoice, b: Invoice) => b.issueDate.localeCompare(a.issueDate));
}

export async function saveInvoice(inv: Invoice, context: string = 'jdg'): Promise<void> {
  if (inv.spId) {
    await InvoicesService.update(inv.spId, invoiceToSp(inv, context));
  } else {
    await InvoicesService.add(invoiceToSp(inv, context));
  }
}

export async function removeInvoice(spId: string): Promise<void> {
  await InvoicesService.delete(spId);
}

// Przetwarzanie PDF — przez nasz backend (Azure Function), klucz Anthropic server-side
export async function processPdfWithAI(base64: string, type: 'sales' | 'cost'): Promise<Partial<Invoice>> {
  const res = await fetch('/api/process-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64: base64, type }),
  });

  if (!res.ok) {
    let msg = 'Błąd przetwarzania PDF';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.invoice as Partial<Invoice>;
}
