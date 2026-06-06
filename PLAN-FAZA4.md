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

## B. Retencja 5 lat — Finance JDG + Finance Spółka

**Decyzja:** 5-letnia polityka retencji na bibliotekach **JDG i Spółka** (Prywatne pomijamy).
Cel: pliki nie mogą zostać usunięte przez 5 lat od utworzenia (zgodność księgowa — art. 74 UoR / 5 lat podatkowo).

> Prawdziwa, wymuszona retencja = **Microsoft Purview**. Nie ustawia się jej niezawodnie przez API
> (wymaga roli *Compliance Administrator* / *Records Management*). Poniżej kroki w portalu.

### Krok po kroku (purview.microsoft.com)
1. Wejdź na **https://purview.microsoft.com** → zaloguj jako admin.
2. Lewe menu: **Solutions → Data Lifecycle Management** (dawniej *Information Governance*).
3. Zakładka **Retention policies** → **＋ New retention policy**.
4. Nazwa: `Finance – retencja 5 lat (JDG + Spółka)`.
5. **Retention settings:**
   - *Retain items for a specific period* → **5 years**.
   - Liczone od: **When items were created**.
   - Po okresie: **Do nothing** (lub *Delete* — zalecane: *Do nothing*, sam zdecydujesz później).
6. **Locations (zakres):** wyłącz wszystko oprócz **SharePoint sites** → *Edit* → **Choose sites**
   → wklej adres: `https://logisticfit.sharepoint.com/sites/finance`.
7. **Przejrzyj i utwórz.** Wdrożenie polityki: do 1–7 dni (Microsoft propaguje w tle).

### Zakres: cała witryna finance (DECYZJA: Opcja 1)
Polityka obejmuje **całą witrynę** `/sites/finance` → JDG + Spółka + **Prywatne**.
Wybrano dla prostoty — jedna polityka, zero dodatkowej pracy, a prywatne dokumenty
i tak warto trzymać 5 lat. W kroku 6 wystarczy wskazać tę jedną witrynę.

### Weryfikacja retencji
- Po wdrożeniu spróbuj usunąć testowy plik z Finance Spółka → trafia do *Preservation Hold Library*
  (kopia zachowana mimo „usunięcia") — to potwierdza, że retencja działa.
- Purview → *Data Lifecycle Management → Policies* → status polityki = **On (success)**.

---

## Status
- [ ] A. Uprawnienia księgowej (skrypt) — czeka na e-mail księgowej
- [ ] B. Retencja Purview — konfiguracja w portalu (ręczna, admin compliance)
