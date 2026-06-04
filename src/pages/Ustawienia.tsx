import { useState } from 'react';
import { Ico } from '../components/ui/icons';

type Tab = 'ogolne' | 'firma' | 'integracje';

export default function Ustawienia() {
  const [tab, setTab] = useState<Tab>('ogolne');
  const [showApiKey, setShowApiKey] = useState(false);

  // Ogólne
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [taxType, setTaxType] = useState('liniowy');

  // Firma
  const [companyName, setCompanyName] = useState('LogisticFit Sp. z o.o.');
  const [nip, setNip] = useState('123-456-78-90');
  const [address, setAddress] = useState('ul. Logistyczna 12, 00-001 Warszawa');
  const [email, setEmail] = useState('biuro@logisticfit.com');

  // Integracje
  const [apiKey, setApiKey] = useState('sk-ant-api03-••••••••••••••••••••••••••');

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1 className="page-h">Ustawienia</h1>
          <p className="page-sub">Konfiguracja aplikacji i integracji</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {([
          { id: 'ogolne',      label: 'Ogólne' },
          { id: 'firma',       label: 'Dane firmy' },
          { id: 'integracje',  label: 'Integracje' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ogolne' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-head"><span>Ustawienia ogólne</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                  Rok obrotowy
                </label>
                <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} style={{ width: '100%', fontSize: '0.9rem' }}>
                  {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                  Wybierz rok, dla którego wyświetlane są dane finansowe.
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                  Forma opodatkowania
                </label>
                <select value={taxType} onChange={e => setTaxType(e.target.value)} style={{ width: '100%', fontSize: '0.9rem' }}>
                  <option value="skala">Skala podatkowa (12% / 32%)</option>
                  <option value="liniowy">Podatek liniowy (19%)</option>
                  <option value="ryczalt">Ryczałt ewidencjonowany</option>
                  <option value="cit">CIT (podatek od osób prawnych)</option>
                </select>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button className="btn btn-primary"><Ico name="Check" size={15} /> Zapisz ustawienia</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'firma' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-head"><span>Dane firmy</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>Nazwa firmy</label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>NIP</label>
                <input
                  value={nip}
                  onChange={e => setNip(e.target.value)}
                  style={{ width: '100%', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>Adres</label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button className="btn btn-primary"><Ico name="Check" size={15} /> Zapisz dane firmy</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'integracje' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 560 }}>
          <div className="card">
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ico name="ShieldCheck" size={16} />
                <span>Anthropic API</span>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Klucz API używany do funkcji AI (analiza dokumentów, asystent).
              </p>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                Klucz API
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
                <button className="btn" onClick={() => setShowApiKey(v => !v)} title={showApiKey ? 'Ukryj' : 'Pokaż'}>
                  <Ico name={showApiKey ? 'Eye' : 'Eye'} size={15} />
                </button>
              </div>
              <button className="btn btn-primary"><Ico name="Check" size={15} /> Zapisz klucz</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ico name="Link" size={16} />
                <span>SharePoint / Microsoft 365</span>
              </div>
            </div>
            <div className="card-body">
              <div className="int-row">
                <div className="int-meta">
                  <span style={{ fontWeight: 500 }}>Status połączenia</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>logisticfit.sharepoint.com</span>
                </div>
                <span className="badge" style={{ background: 'var(--green-50, #f0fdf4)', color: 'var(--green-600)', border: '1px solid var(--green-200, #bbf7d0)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Ico name="CheckCircle" size={13} /> Połączono
                </span>
              </div>
              <div className="int-row" style={{ marginTop: '1rem' }}>
                <div className="int-meta">
                  <span style={{ fontWeight: 500 }}>Konto</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>michal@logisticfit.com</span>
                </div>
                <button className="btn"><Ico name="Refresh" size={14} /> Odśwież token</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
