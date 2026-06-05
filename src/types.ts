export type VATRate = 0 | 5 | 8 | 23;

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface Invoice {
  id?: string;          // SharePoint item ID
  spId?: string;        // SharePoint internal ID
  type: 'sales' | 'cost';
  number: string;
  issueDate: string;
  dueDate: string;
  counterparty: string;
  nip: string;
  lines: InvoiceLine[];
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  currency: string;
  paid: boolean;
  paymentDate?: string;
  notes?: string;
  fileUrl?: string;     // link do głównego PDF w bibliotece dokumentów
  attachments?: { name: string; url: string }[];  // wszystkie dokumenty faktury (główny + załączniki)
  infaktId?: string;    // id/uuid w inFakt (transient — do archiwizacji, nie zapisywane)
  infaktUuid?: string;
}

export interface BankTransaction {
  spId?: string;
  date: string;
  description: string;
  counterparty?: string;
  amount: number;
  balance: number;
  type: 'credit' | 'debit';
  account?: string;
}
