# Faza 4 — Uprawnienia księgowej + Retencja 5 lat

Witryna: **logisticfit.sharepoint.com/sites/finance**
Biblioteki: `Finance JDG`, `Finance Spółka`, `Finance Prywatne`

---

## A. Dostęp księgowej — TYLKO Finance Spółka, tylko odczyt

**Decyzje:** księgowa widzi wyłącznie bibliotekę **Finance Spółka**, w trybie **tylko do odczytu**.
Nie ma dostępu do JDG, Prywatnych ani reszty witryny.

### Wykonanie (skrypt)
```bash
cd ~/Cash-app/setup
node grant-accountant-access.mjs <email-księgowej>
```
Skrypt udostępnia *korzeń* biblioteki Finance Spółka z rolą `read` (mechanizm „invite").
Dostęp jest ograniczony do tej jednej biblioteki — SharePoint automatycznie nadaje
„limited access" do witryny (potrzebne do otwarcia), ale pozostałe biblioteki są niewidoczne.

**Cofnięcie dostępu:**
```bash
node grant-accountant-access.mjs <email-księgowej> --revoke
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
   cd ~/Cash-app/setup && node backup-finance-docs.mjs
   ```
   Cel: `~/LogisticFit-Finance-Backup/<data>/<biblioteka>/...`. Wznawialny (pomija pobrane).
   **Zalecenie: uruchamiać co miesiąc/kwartał** (można dodać do harmonogramu).

### Gdyby kiedyś jednak Purview (po upgrade do Business Premium)
Patrz historia git tej sekcji — kroki: purview.microsoft.com → Data Lifecycle Management →
Retention policies → 5 lat od utworzenia → zakres: witryna `/sites/finance`.

---

## Status
- [ ] A. Uprawnienia księgowej (skrypt) — czeka na e-mail księgowej
- [x] B. Retencja — Purview niedostępny (Business Standard); zamiast tego wersjonowanie +
      read-only + backup offline (`backup-finance-docs.mjs`). Pozostaje uruchamiać backup cyklicznie.
