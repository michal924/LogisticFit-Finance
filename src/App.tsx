import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { msalInstance } from './main';
import { loginRequest } from './auth/msalConfig';
import { AppShell } from './components/layout/AppShell';

// Pages (stub — rozbudowane w Fazie 3)
const Dashboard     = React.lazy(() => import('./pages/Dashboard'));
const FakturySprzedazy = React.lazy(() => import('./pages/FakturySprzedazy'));
const FakturyKosztowe  = React.lazy(() => import('./pages/FakturyKosztowe'));
const Bank          = React.lazy(() => import('./pages/Bank'));
const BankPrywatny  = React.lazy(() => import('./pages/BankPrywatny'));
const Kontrahenci   = React.lazy(() => import('./pages/Kontrahenci'));
const Koszty        = React.lazy(() => import('./pages/Koszty'));
const JPK           = React.lazy(() => import('./pages/JPK'));
const Raporty       = React.lazy(() => import('./pages/Raporty'));
const Ustawienia    = React.lazy(() => import('./pages/Ustawienia'));

function AuthGate({ children }: { children: React.ReactNode }) {
  const { accounts, instance } = useMsal();
  if (!accounts.length) {
    instance.loginRedirect(loginRequest);
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Logowanie...</div>;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <AuthGate>
          <React.Suspense fallback={<div>Ładowanie...</div>}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="faktury-sprzedazy" element={<FakturySprzedazy />} />
                <Route path="faktury-kosztowe" element={<FakturyKosztowe />} />
                <Route path="bank" element={<Bank />} />
                <Route path="bank-prywatny" element={<BankPrywatny />} />
                <Route path="kontrahenci" element={<Kontrahenci />} />
                <Route path="koszty" element={<Koszty />} />
                <Route path="jpk" element={<JPK />} />
                <Route path="raporty" element={<Raporty />} />
                <Route path="ustawienia" element={<Ustawienia />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Route>
            </Routes>
          </React.Suspense>
        </AuthGate>
      </BrowserRouter>
    </MsalProvider>
  );
}
