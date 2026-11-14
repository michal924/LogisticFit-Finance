# Faza 4 — Uprawnienia księgowej + Retencja 5 lat

Witryna: **logisticfit.sharepoint.com/sites/finance**
Biblioteki: `Finance JDG`, `Finance Spółka`, `Finance Prywatne`

---

## A. Dostęp księgowej — TYLKO Finance Spółka, tylko odczyt

**Decyzje:** księgowa widzi wyłącznie bibliotekę **Finance Spółka**, w trybie **tylko do odczytu**.
Nie ma dostępu do JDG, Prywatnych ani reszty witryny.

### Wykonanie (skrypt)
```bash
cd ~/Projekty/LogisticFit-Finance
node setup/grant-accountant-access.mjs <email-księgowej>          # pyta o potwierdzenie, wysyła zaproszenie
node setup/grant-accountant-access.mjs <email-księgowej> --no-email # bez e-maila
node setup/grant-accountant-access.mjs --list                       # obecne uprawnienia biblioteki
```
> Skrypty z `~/Cash-app/setup` zaginęły przy migracji (2026-11-01) i zostały odtworzone
> w `setup/` tego repo (2026-11-14). Logowanie: przy pierwszym uruchomieniu skrypt pokazuje kod
> do wpisania na microsoft.com/devicelogin (konto właściciela). Token zapisuje się w
> `~/.logisticfit-finance/token.json` i wystarcza na kolejne uruchomienia.
Skrypt udostępnia *korzeń* biblioteki Finance Spółka z rolą `read` (mechanizm „invite").
Dostęp jest ograniczony do tej jednej biblioteki — SharePoint automatycznie nadaje
„limited access" do witryny (potrzebne do otwarcia), ale pozostałe biblioteki są niewidoczne.

**Cofnięcie dostępu:**
```bash
node setup/grant-accountant-access.mjs <email-księgowej> --revoke
```

### Weryfikacja
1. Księgowa dostaje e-mail z linkiem do biblioteki (lub otwiera witrynę → widzi tylko Finance Spółka).
2. Próba edycji/usunięcia pliku → brak takiej opcji (Read-only).
3. JDG i Prywatne nie pojawiają się w nawigacji.

### Alternatywa ręczna (gdyby skrypt zawiódł)
Biblioteka Finance Spółka → ⚙ → *Library settings* → *Permissions for this document library*
→ *Stop Inheriting Permissions* → *Grant Permissions* → dodaj księgową → poziom **Read**.

---

## B. Retencja 5 lat — bez Purview (Business Standard)

**Ustalenie (sprawdzone `check-m365-license.mjs`):** tenant ma **Microsoft 365 Business Standard**
[`O365_BUSINESS_PREMIUM`, 3/3]. **Business Standard NIE zawiera polityk retencji Purview** —
opcja nie pojawi się w portalu. Retencja wymaga Business Premium / E3 / E5.

> Purview porzucony świadomie — nie dopłacamy. Obowiązek 5 lat (art. 74 UoR) spełnia
> **redundancja**: dokumenty są w SharePoint + inFakt (system źródłowy) + lokalny backup.

### Zabezpieczenia zastosowane zamiast Purview
1. **Wersjonowanie** — biblioteki SharePoint mają domyślnie włączone (historia wersji + kosz 93 dni).
   Weryfikacja: biblioteka → ⚙ → *Library settings* → *Versioning settings* → *Create major versions* = ON.
2. **Tylko odczyt dla nie-właścicieli** — księgowa i przyszli użytkownicy dostają Read (część A),
   więc nie mogą usuwać. Aplikacja zapisuje creds. właściciela.
   > Haczyk: właściciela (Michał) na Business Standard nie da się zablokować przed usuwaniem —
   > twarda immutabilność istnieje tylko w Purview. Stąd backup poniżej.
3. **Backup offline (3. kopia)** — `backup-finance-docs.mjs` pobiera wszystkie biblioteki na dysk:
   ```bash
   cd ~/Projekty/LogisticFit-Finance && node setup/backup-finance-docs.mjs
   node setup/backup-finance-docs.mjs --dry-run            # tylko policz pliki i rozmiar
   node setup/backup-finance-docs.mjs --date RRRR-MM-DD    # dokończ przerwany backup
   ```
   Cel: `~/LogisticFit-Finance-Backup/<data>/<biblioteka>/...`. Wznawialny (pomija pobrane).
   Każdy przebieg zapisuje `manifest.json` (lista plików, rozmiary, błędy).
   **Harmonogram co miesiąc** (1. dnia o 9:00, LaunchAgent macOS; po pierwszym ręcznym backupie):
   ```bash
   ./setup/install-backup-schedule.sh              # instalacja
   ./setup/install-backup-schedule.sh --uninstall  # usunięcie
   ```
   Log: `~/LogisticFit-Finance-Backup/logs/backup.log`. Każdy miesiąc to pełna kopia,
   więc stare foldery z datami warto co jakiś czas przenieść na dysk zewnętrzny.

### Gdyby kiedyś jednak Purview (po upgrade do Business Premium)
Patrz historia git tej sekcji — kroki: purview.microsoft.com → Data Lifecycle Management →
Retention policies → 5 lat od utworzenia → zakres: witryna `/sites/finance`.

---

## Status
- [ ] A. Uprawnienia księgowej — skrypt odtworzony (`setup/grant-accountant-access.mjs`), czeka na e-mail księgowej
- [x] B. Retencja — Purview niedostępny (Business Standard); zamiast tego wersjonowanie +
      read-only + backup offline (`setup/backup-finance-docs.mjs`, odtworzony 2026-11-14).
- [ ] B2. Pierwszy backup ręcznie (logowanie) + `./setup/install-backup-schedule.sh`
