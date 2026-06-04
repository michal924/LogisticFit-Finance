// Uproszczone uprawnienia — tylko właściciel
import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();
  const email = user?.username ?? '';
  const isAdmin = email === 'michal@logisticfit.com';
  const hasRole = (_role: string) => isAdmin;
  return { isAdmin, hasRole, userEmail: email };
}
