// ============================================================
//  Finance LogisticFit — Backend: przetwarzanie PDF faktury
//  Klucz Anthropic trzymany SERWER-SIDE (process.env), nigdy w przeglądarce.
//  Endpoint: POST /api/process-pdf  { pdfBase64, type: 'sales'|'cost' }
// ============================================================

module.exports = async function (context, req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, body: { error: 'Brak ANTHROPIC_API_KEY w konfiguracji serwera' } };
    return;
  }

  const { pdfBase64, type } = req.body || {};
  if (!pdfBase64) {
    context.res = { status: 400, body: { error: 'Brak pdfBase64' } };
    return;
  }

  const systemHint = type === 'sales' ? 'sprzedażowa' : 'kosztowa';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            {
              type: 'text',
              text: `Jesteś asystentem do rozpoznawania polskich faktur VAT. Typ faktury: ${systemHint}.
Wyodrębnij dane i zwróć TYLKO JSON (bez żadnego tekstu):
{"number":"","issueDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD","counterparty":"","nip":"","lines":[{"description":"","quantity":1,"unitPrice":0,"vatRate":23,"netAmount":0,"vatAmount":0,"grossAmount":0}],"netTotal":0,"vatTotal":0,"grossTotal":0,"currency":"PLN"}
Zasady: vatRate tylko 0/5/8/23, kwoty jako liczby, daty YYYY-MM-DD.`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      context.res = { status: 502, body: { error: 'Błąd Anthropic API: ' + txt.slice(0, 300) } };
      return;
    }

    const json = await res.json();
    const text = json.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      context.res = { status: 422, body: { error: 'AI nie zwróciło JSON' } };
      return;
    }

    const invoice = JSON.parse(match[0]);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { invoice },
    };
  } catch (e) {
    context.res = { status: 500, body: { error: 'Wyjątek serwera: ' + (e.message || String(e)) } };
  }
};
