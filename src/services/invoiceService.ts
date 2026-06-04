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
  };
}

// Mapowanie Invoice → SharePoint fields
function invoiceToSp(inv: Invoice) {
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
  };
}

export async function getInvoices(type: 'sales' | 'cost'): Promise<Invoice[]> {
  const items = await InvoicesService.getAll();
  return items
    .map((i: any) => spToInvoice(i))
    .filter((i: Invoice) => i.type === type)
    .sort((a: Invoice, b: Invoice) => b.issueDate.localeCompare(a.issueDate));
}

export async function saveInvoice(inv: Invoice): Promise<void> {
  if (inv.spId) {
    await InvoicesService.update(inv.spId, invoiceToSp(inv));
  } else {
    await InvoicesService.add(invoiceToSp(inv));
  }
}

export async function removeInvoice(spId: string): Promise<void> {
  await InvoicesService.delete(spId);
}

// Przetwarzanie PDF przez Claude Haiku
export async function processPdfWithAI(base64: string, type: 'sales' | 'cost'): Promise<Partial<Invoice>> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Brak klucza VITE_ANTHROPIC_API_KEY');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Jesteś asystentem do rozpoznawania polskich faktur VAT. Typ faktury: ${type === 'sales' ? 'sprzedażowa' : 'kosztowa'}.
Wyodrębnij dane i zwróć TYLKO JSON (bez żadnego tekstu):
{"number":"","issueDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD","counterparty":"","nip":"","lines":[{"description":"","quantity":1,"unitPrice":0,"vatRate":23,"netAmount":0,"vatAmount":0,"grossAmount":0}],"netTotal":0,"vatTotal":0,"grossTotal":0,"currency":"PLN"}
Zasady: vatRate tylko 0/5/8/23, kwoty jako liczby, daty YYYY-MM-DD.`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error('Błąd API Anthropic: ' + await res.text());
  const json = await res.json();
  const text = json.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI nie zwróciło JSON');
  return JSON.parse(match[0]);
}
