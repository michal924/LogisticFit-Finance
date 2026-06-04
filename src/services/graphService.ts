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
