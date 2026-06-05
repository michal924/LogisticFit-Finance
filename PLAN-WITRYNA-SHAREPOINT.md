# Plan: dedykowana witryna SharePoint dla LogisticFit Finance

> Cel: przenieść aplikację z głównej witryny zespołu na **dedykowaną witrynę** `/sites/finance`
> — izolacja danych finansowych, czyste uprawnienia (księgowa), retencja 5 lat, spójność z AuditCRM.
> Stan: 2026-06-05

---

## Dlaczego dedykowana witryna

| Korzyść | Szczegół |
|---|---|
| **Izolacja** | Dokumenty finansowe poza głównym site firmowym |
| **Uprawnienia** | Księgowa dostaje dostęp do witryny Finanse, nie ruszamy reszty |
| **Retencja 5 lat** | Polityka na całą witrynę (wymóg KAS) |
| **Porządek** | Własny portal, jak AuditCRM |
| **Migracja tania** | Dokumenty odtwarzalne z inFakt (re-archiwizacja), nie ręczne przenoszenie |

---

## Architektura docelowa

```
logisticfit.sharepoint.com/sites/finance     ← NOWA dedykowana witryna
│
├── LISTY (dane aplikacji)
│   ├── Finance Invoices              (+ Context, FileUrl)
│   ├── Finance Transactions          (+ Context)
│   ├── Finance Private Transactions
│   ├── Finance Contractors           (+ Context)
│   ├── Finance JPK                   (+ Context)
│   └── Finance Settings
│
├── BIBLIOTEKI (dokumenty)
│   ├── Finance JDG/       → Faktury sprzedaży, kosztowe, Wyciągi, JPK
│   ├── Finance Spółka/    → (te same)
│   └── Finance Prywatne/  → Wyciągi
│
└── STRONA GŁÓWNA (portal)
    └── kafelki: Dokumenty per działalność, listy, link do aplikacji
```

---

## Fazy wdrożenia

### Faza 0 — Utworzenie witryny *(Ty, ~3 min)*
SharePoint nie pozwala łatwo tworzyć witryn przez skrypt (wymaga uprawnień admina site collection).
Najprościej ręcznie:
1. Wejdź na `logisticfit.sharepoint.com`
2. Prawy górny → **+ Utwórz witrynę** (Create site)
3. Wybierz **Witryna zespołu** (Team site)
4. Nazwa: **LogisticFit Finance**, adres: `finance` → URL `/sites/finance`
5. Prywatność: **Prywatna**
6. Utwórz

> Alternatywnie: SharePoint Admin Center → Active sites → Create.

### Faza 1 — Populacja witryny *(skrypt, ~5 min)*
Uruchom **jeden** skrypt który tworzy na nowej witrynie:
- 6 list + kolumny (Context, FileUrl)
- 3 biblioteki + foldery
```bash
node ~/Cash-app/setup/setup-finance-site.mjs
```
Skrypt sam znajdzie witrynę `/sites/finance` i wszystko utworzy.

### Faza 2 — Przepięcie aplikacji *(ja, ~5 min)*
- Zmiana `SHAREPOINT_SITE_ID` w `src/auth/msalConfig.ts` na nowy site ID
- Commit + deploy
- Aplikacja czyta/zapisuje już na nowej witrynie

### Faza 3 — Migracja danych *(skrypt/sync, ~15 min)*
- **Faktury** → dociągną się z inFakt (przycisk "Synchronizuj")
- **Transakcje bankowe + prywatne** → skrypt migracyjny (mamy `data.json`)
- **Dokumenty PDF** → "Pełna archiwizacja" (re-pobranie z inFakt na nową witrynę)

### Faza 4 — Uprawnienia i retencja *(Ty + ja, ~1-2 h)*
- **Uprawnienia:** dodaj księgową do witryny Finanse (lub tylko biblioteki Spółka)
- **Retencja 5 lat:** Microsoft Purview → polityka na witrynę `/sites/finance`
- **Strona-portal:** kafelki na stronie głównej witryny

---

## Co się NIE zmienia
- Logika aplikacji, ekrany, inFakt, branding — bez zmian
- Tylko **gdzie** trzymane są dane (nowa witryna zamiast root)

## Ryzyka i mitygacja
| Ryzyko | Mitygacja |
|---|---|
| Utrata danych przy migracji | Stara witryna zostaje nietknięta do potwierdzenia |
| Aplikacja nie widzi nowej witryny | Test po przepięciu SITE_ID przed migracją |
| Re-archiwizacja długa | Dokumenty z inFakt, jednorazowo |

---

## Kolejność działania (rekomendowana)
1. ✅ Dokończ obecną archiwizację (test że mechanizm działa)
2. **Faza 0** — utwórz witrynę `/sites/finance`
3. **Faza 1** — uruchom `setup-finance-site.mjs`
4. **Faza 2** — przepnę aplikację, zweryfikujemy że czyta nową witrynę (pusta)
5. **Faza 3** — migracja danych + re-archiwizacja
6. **Faza 4** — uprawnienia (księgowa) + retencja
7. Po potwierdzeniu — opcjonalnie wyczyścić stare listy/biblioteki z root site

---

## Decyzje do potwierdzenia
1. Nazwa/adres witryny: **LogisticFit Finance** / `/sites/finance` — OK?
2. Księgowa — dostęp do całej witryny czy tylko `Finance Spółka`?
3. Retencja 5 lat — włączyć od razu?
