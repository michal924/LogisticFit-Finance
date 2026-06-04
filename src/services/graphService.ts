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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

const SITE = `/sites/${SHAREPOINT_SITE_ID}`;

// ---- Generic LIST operations ----
export async function getListItems(listName: string, select?: string, filter?: string) {
  let url = `${SITE}/lists/${listName}/items?expand=fields`;
  if (select) url += `&$select=${select}`;
  if (filter) url += `&$filter=${filter}`;
  const res = await graphFetch('GET', url);
  return res.value;
}

export async function addListItem(listName: string, fields: object) {
  return graphFetch('POST', `${SITE}/lists/${listName}/items`, { fields });
}

export async function updateListItem(listName: string, id: string, fields: object) {
  return graphFetch('PATCH', `${SITE}/lists/${listName}/items/${id}`, { fields });
}

export async function deleteListItem(listName: string, id: string) {
  return graphFetch('DELETE', `${SITE}/lists/${listName}/items/${id}`);
}

// ---- Specific services ----
export const InvoicesService = {
  getAll: () => getListItems('FinanceInvoices'),
  add: (fields: object) => addListItem('FinanceInvoices', fields),
  update: (id: string, fields: object) => updateListItem('FinanceInvoices', id, fields),
  delete: (id: string) => deleteListItem('FinanceInvoices', id),
};

export const TransactionsService = {
  getAll: () => getListItems('FinanceTransactions'),
  add: (fields: object) => addListItem('FinanceTransactions', fields),
  delete: (id: string) => deleteListItem('FinanceTransactions', id),
};

export const PrivateTransactionsService = {
  getAll: (account?: string) => getListItems('FinancePrivateTransactions', undefined, account ? `fields/Account eq '${account}'` : undefined),
  add: (fields: object) => addListItem('FinancePrivateTransactions', fields),
  delete: (id: string) => deleteListItem('FinancePrivateTransactions', id),
};

export const ContractorsService = {
  getAll: () => getListItems('FinanceContractors'),
  add: (fields: object) => addListItem('FinanceContractors', fields),
  update: (id: string, fields: object) => updateListItem('FinanceContractors', id, fields),
};

export const JPKService = {
  getAll: () => getListItems('FinanceJPK'),
  add: (fields: object) => addListItem('FinanceJPK', fields),
};

export const SettingsService = {
  getAll: () => getListItems('FinanceSettings'),
  set: (key: string, value: string) => addListItem('FinanceSettings', { SettingKey: key, SettingValue: value }),
};
