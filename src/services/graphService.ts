import { msalInstance } from '../main';
import { loginRequest, SHAREPOINT_SITE_ID, GRAPH_BASE } from '../auth/msalConfig';

async function getToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) throw new Error('Nie zalogowano');
  const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
  return result.accessToken;
}

async function graphFetch(method: string, path: string, body?: object) {
  const token = await getToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

const SITE = `/sites/${SHAREPOINT_SITE_ID}`;

// ---- Lista ID cache — wykrywa rzeczywiste ID list po display name ----
let listIdCache: Record<string, string> = {};

async function getListId(displayName: string): Promise<string> {
  if (listIdCache[displayName]) return listIdCache[displayName];

  // Załaduj wszystkie listy Finance raz
  if (Object.keys(listIdCache).length === 0) {
    const res = await graphFetch('GET', `${SITE}/lists?$select=id,displayName&$top=100`);
    for (const l of (res.value || [])) {
      listIdCache[l.displayName] = l.id;
    }
  }

  const id = listIdCache[displayName];
  if (!id) throw new Error(`Lista SharePoint nie znaleziona: "${displayName}"`);
  return id;
}

// ---- Generic LIST operations (używa ID listy) ----
export async function getListItems(displayName: string, filter?: string): Promise<any[]> {
  const listId = await getListId(displayName);
  let url = `${SITE}/lists/${listId}/items?expand=fields&$top=5000`;
  if (filter) url += `&$filter=${filter}`;
  const res = await graphFetch('GET', url);
  return res.value || [];
}

// Filtruje pozycje po polu Context (client-side — uniknięcie problemów z indeksami)
export function filterByContext(items: any[], context: string): any[] {
  return items.filter(it => {
    const ctx = it.fields?.Context || 'jdg'; // domyślnie jdg dla starych rekordów
    return ctx === context;
  });
}

// ====================================================================
//  BIBLIOTEKI DOKUMENTÓW — archiwum oryginalnych plików (PDF/CSV/XML)
// ====================================================================

// Mapowanie kontekstu → nazwa biblioteki dokumentów
const LIBRARY_BY_CONTEXT: Record<string, string> = {
  jdg:      'Finance JDG',
  spolka:   'Finance Spółka',
  prywatne: 'Finance Prywatne',
};

const MONTH_FOLDERS = ['01-Styczeń','02-Luty','03-Marzec','04-Kwiecień','05-Maj','06-Czerwiec',
  '07-Lipiec','08-Sierpień','09-Wrzesień','10-Październik','11-Listopad','12-Grudzień'];

// Cache drive ID per biblioteka
const driveIdCache: Record<string, string> = {};

async function getDriveId(libraryName: string): Promise<string> {
  if (driveIdCache[libraryName]) return driveIdCache[libraryName];
  const listId = await getListId(libraryName);
  const res = await graphFetch('GET', `${SITE}/lists/${listId}/drive?$select=id`);
  driveIdCache[libraryName] = res.id;
  return res.id;
}

// Sanityzuje nazwę pliku (usuwa znaki niedozwolone w SharePoint)
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|#%]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Wgrywa plik do biblioteki dokumentów we właściwym folderze.
 * @param context  jdg / spolka / prywatne
 * @param category np. "Faktury sprzedaży", "Faktury kosztowe", "Wyciągi bankowe", "JPK"
 * @param dateStr  data dokumentu "YYYY-MM-DD" (wyznacza folder rok/miesiąc)
 * @param fileName nazwa docelowa pliku (np. "FV-2026-001.pdf")
 * @param content  zawartość (ArrayBuffer / Blob / Uint8Array)
 * @returns webUrl wgranego pliku (do zapisania jako FileUrl na liście)
 */
export async function uploadDocument(
  context: string,
  category: string,
  dateStr: string,
  fileName: string,
  content: ArrayBuffer | Blob | Uint8Array,
): Promise<string> {
  const library = LIBRARY_BY_CONTEXT[context] || 'Finance JDG';
  const driveId = await getDriveId(library);

  // Folder: Kategoria/Rok/MM-Miesiąc
  const d = dateStr && /^\d{4}-\d{2}/.test(dateStr) ? dateStr : new Date().toISOString();
  const year = d.slice(0, 4);
  const monthIdx = parseInt(d.slice(5, 7), 10) - 1;
  const monthFolder = MONTH_FOLDERS[monthIdx] || '01-Styczeń';
  const folderPath = `${category}/${year}/${monthFolder}`;

  const safeName = sanitizeFileName(fileName);
  const uploadPath = `${SITE}/drives/${driveId}/root:/${encodeURI(`${folderPath}/${safeName}`)}:/content`;

  const token = await getToken();
  const res = await fetch(`${GRAPH_BASE}${uploadPath}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: content as BodyInit,
  });
  if (!res.ok) throw new Error('Upload nieudany: ' + await res.text());
  const item = await res.json();
  return item.webUrl as string;
}

export async function addListItem(displayName: string, fields: object) {
  const listId = await getListId(displayName);
  return graphFetch('POST', `${SITE}/lists/${listId}/items`, { fields });
}

export async function updateListItem(displayName: string, id: string, fields: object) {
  const listId = await getListId(displayName);
  return graphFetch('PATCH', `${SITE}/lists/${listId}/items/${id}`, { fields });
}

export async function deleteListItem(displayName: string, id: string) {
  const listId = await getListId(displayName);
  return graphFetch('DELETE', `${SITE}/lists/${listId}/items/${id}`);
}

// ---- Nazwy list (display names z SharePoint) ----
const L = {
  invoices:     'Finance Invoices',
  transactions: 'Finance Transactions',
  private:      'Finance Private Transactions',
  contractors:  'Finance Contractors',
  jpk:          'Finance JPK',
  settings:     'Finance Settings',
};

export const InvoicesService = {
  getAll:  ()                    => getListItems(L.invoices),
  add:     (fields: object)      => addListItem(L.invoices, fields),
  update:  (id: string, f: object) => updateListItem(L.invoices, id, f),
  delete:  (id: string)          => deleteListItem(L.invoices, id),
};

export const TransactionsService = {
  getAll:  ()               => getListItems(L.transactions),
  add:     (f: object)      => addListItem(L.transactions, f),
  delete:  (id: string)     => deleteListItem(L.transactions, id),
};

export const PrivateTransactionsService = {
  getAll:  (account?: string) => getListItems(L.private, account ? `fields/Account eq '${account}'` : undefined),
  add:     (f: object)        => addListItem(L.private, f),
  delete:  (id: string)       => deleteListItem(L.private, id),
};

export const ContractorsService = {
  getAll:  ()                    => getListItems(L.contractors),
  add:     (f: object)           => addListItem(L.contractors, f),
  update:  (id: string, f: object) => updateListItem(L.contractors, id, f),
};

export const JPKService = {
  getAll: () => getListItems(L.jpk),
  add:    (f: object) => addListItem(L.jpk, f),
};

export const SettingsService = {
  getAll: () => getListItems(L.settings),
  set:    (key: string, value: string) => addListItem(L.settings, { SettingKey: key, SettingValue: value }),
};
