import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider, useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { msalInstance } from './main';
import { loginRequest } from './auth/msalConfig';
import { AppShell } from './components/layout/AppShell';

const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const FakturySprzedazy = React.lazy(() => import('./pages/FakturySprzedazy'));
const FakturyKosztowe  = React.lazy(() => import('./pages/FakturyKosztowe'));
const Bank             = React.lazy(() => import('./pages/Bank'));
const BankPrywatny     = React.lazy(() => import('./pages/BankPrywatny'));
const Kontrahenci      = React.lazy(() => import('./pages/Kontrahenci'));
const Koszty           = React.lazy(() => import('./pages/Koszty'));
const JPK              = React.lazy(() => import('./pages/JPK'));
const Raporty          = React.lazy(() => import('./pages/Raporty'));
const Dokumenty        = React.lazy(() => import('./pages/Dokumenty'));
const Ustawienia       = React.lazy(() => import('./pages/Ustawienia'));

function LoginRedirect() {
  const { instance } = useMsal();
  useEffect(() => {
    instance.loginRedirect(loginRequest).catch(console.error);
  }, [instance]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, fontFamily: 'Poppins, sans-serif' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #3a4d98', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#3a4d98', fontWeight: 600 }}>Logowanie…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <AuthenticatedTemplate>
          <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Ładowanie…</div>}>
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
                <Route path="dokumenty" element={<Dokumenty />} />
                <Route path="ustawienia" element={<Ustawienia />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Route>
            </Routes>
          </React.Suspense>
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
          <LoginRedirect />
        </UnauthenticatedTemplate>
      </BrowserRouter>
    </MsalProvider>
  );
}
