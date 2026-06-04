import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ContextKey = 'jdg' | 'spolka' | 'prywatne';

export interface BusinessContext {
  key: ContextKey;
  name: string;
  short: string;
  nip?: string;
  type: 'jdg' | 'company' | 'private';
  color: string;      // accent dla badge
  taxForm: string;
}

export const CONTEXTS: BusinessContext[] = [
  { key: 'jdg',      name: 'JDG Michał Rzeźnik',      short: 'JDG',      nip: '', type: 'jdg',     color: '#3a4d98', taxForm: 'skala' },
  { key: 'spolka',   name: 'LogisticFit Sp. z o.o.',  short: 'Spółka',   nip: '', type: 'company', color: '#239d46', taxForm: 'cit' },
  { key: 'prywatne', name: 'Finanse prywatne',         short: 'Prywatne', type: 'private', color: '#6b7392', taxForm: 'none' },
];

interface ContextState {
  active: ContextKey;
  setActive: (k: ContextKey) => void;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      active: 'jdg',
      setActive: (k) => set({ active: k }),
    }),
    { name: 'lf-context' }
  )
);

export function getContext(key: ContextKey): BusinessContext {
  return CONTEXTS.find(c => c.key === key) ?? CONTEXTS[0];
}
