# Plan systemu przechowywania danych — SharePoint

> Dokument planistyczny dla LogisticFit Finance. Stan na 2026-06-05.

---

## 1. Stan obecny

### Co mamy
SharePoint Site: `logisticfit.sharepoint.com` (zespół LogisticFit)

**6 List (dane strukturalne — "baza danych"):**
| Lista | Zawartość | Kontekst |
|---|---|---|
| Finance Invoices | faktury sprzedaży + kosztowe | ✅ Context |
| Finance Transactions | transakcje bank firmowy | ✅ Context |
| Finance Private Transactions | bank prywatny (4 konta) | pole Account |
| Finance Contractors | kontrahenci | ✅ Context |
| Finance JPK | rejestr plików JPK | ✅ Context |
| Finance Settings | ustawienia | — |

### 🔴 KLUCZOWA LUKA
**Oryginalne pliki PDF faktur NIE są nigdzie zapisywane.**

Obecny przepływ:
```
PDF → Claude AI wyciąga dane → zapis do listy → PDF znika ❌
```

To problem prawny — **KAS może żądać oryginałów faktur do 5 lat wstecz**. Bez archiwum dokumentów źródłowych jesteśmy nieprzygotowani na kontrolę.

Dodatkowo nie archiwizujemy:
- Wyciągów bankowych CSV (importowane, potem znikają)
- Plików JPK_V7M XML (gdy będą generowane)

---

## 2. Proponowana architektura

Dwa uzupełniające się systemy w SharePoint:

### A) Listy (dane strukturalne) — "baza danych"
Zostają bez zmian. Przechowują przeszukiwalne wiersze. Kolumna Context rozdziela działalności. ✅ już działa

### B) Biblioteka dokumentów (pliki) — "archiwum" — NOWE
Nowa biblioteka **"Finance Dokumenty"** z folderami:

```
Finance Dokumenty/                    (Biblioteka dokumentów)
│
├── JDG/
│   ├── Faktury sprzedaży/
│   │   └── 2026/
│   │       ├── 01-Styczeń/
│   │       │   ├── FV-2026-001.pdf
│   │       │   └── FV-2026-002.pdf
│   │       └── 02-Luty/...
│   ├── Faktury kosztowe/
│   │   └── 2026/01-Styczeń/...
│   ├── Wyciągi bankowe/
│   │   └── 2026/wyciag-2026-01.csv
│   └── JPK/
│       └── 2026/JPK_V7M-2026-01.xml
│
├── Spółka/
│   ├── Faktury sprzedaży/
│   ├── Faktury kosztowe/
│   ├── Wyciągi bankowe/
│   └── JPK/
│
└── Prywatne/
    └── Wyciągi bankowe/
        └── 2026/...
```

### Powiązanie pliki ↔ listy
Każda faktura na liście dostaje pole **`FileUrl`** → link do PDF w bibliotece.
Klik na fakturę w aplikacji → "Otwórz oryginał" → otwiera PDF.

---

## 3. Konwencje nazewnictwa

| Typ | Wzór | Przykład |
|---|---|---|
| Faktura | `{NrFaktury}.pdf` | `FV-2026-001.pdf` |
| Wyciąg bankowy | `wyciag-{rok}-{mies}.csv` | `wyciag-2026-01.csv` |
| JPK | `JPK_V7M-{rok}-{mies}.xml` | `JPK_V7M-2026-01.xml` |

Folder per **rok/miesiąc** bo:
- Rozliczenia VAT są miesięczne (JPK_V7M)
- Łatwe odnalezienie dokumentów za dany okres podczas kontroli
- Wymóg 5-letniej archiwizacji → czysta struktura

---

## 4. Dwie opcje organizacji (do decyzji)

### Opcja 1 — Jedna biblioteka, foldery per działalność *(rekomendowana)*
- `Finance Dokumenty/JDG/...`, `/Spółka/...`, `/Prywatne/...`
- Prościej, jedno miejsce
- ✅ wystarczające dla małego zespołu

### Opcja 2 — Trzy osobne biblioteki
- `Finance JDG`, `Finance Spółka`, `Finance Prywatne`
- Lepsze izolowanie uprawnień (np. księgowa widzi tylko Spółkę)
- Bardziej złożone

**Rekomendacja:** Opcja 1, chyba że planujesz dać księgowej dostęp tylko do wybranej działalności — wtedy Opcja 2.

---

## 5. Plan wdrożenia (fazy)

| Faza | Co | Czas | Wymaga |
|---|---|---|---|
| **A** | Utworzenie biblioteki + struktury folderów | 0,5 dnia | skrypt + logowanie |
| **B** | Upload PDF do biblioteki przy imporcie + pole FileUrl | 1 dzień | kod |
| **C** | Przycisk "Otwórz oryginał" w panelu faktury | 0,5 dnia | kod |
| **D** | Archiwizacja wyciągów CSV przy imporcie banku | 0,5 dnia | kod |
| **E** | Zapis JPK_V7M XML (gdy generowanie gotowe) | później | kod |

**Razem faza A–D: ~2,5 dnia**

---

## 6. Co zyskujemy

✅ Zgodność z prawem — oryginały faktur archiwizowane (5 lat)
✅ Gotowość na kontrolę KAS — dokumenty per okres
✅ Pełna historia — wyciągi bankowe, JPK
✅ Porządek per działalność (JDG / Spółka / Prywatne)
✅ Z aplikacji jednym klikiem otwierasz oryginał faktury

---

## 7. Proponowane kolejne działania (po powrocie)

1. **Decyzja:** Opcja 1 czy 2 (jedna biblioteka vs trzy)
2. **Uruchomienie skryptu** `create-document-library.mjs` → tworzy bibliotekę i foldery
3. **Wdrożenie Fazy B** — upload PDF przy imporcie faktur
4. **Test** — wrzuć fakturę, sprawdź czy PDF ląduje w `Finance Dokumenty/JDG/Faktury.../2026/...`

Skrypt do utworzenia biblioteki przygotowany i czeka: `~/Cash-app/setup/create-document-library.mjs`
