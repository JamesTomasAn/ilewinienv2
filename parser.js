// Parser tekstu z polskich paragonów fiskalnych (wynik OCR -> lista pozycji).
// Kwoty trzymane są w groszach (liczby całkowite), aby uniknąć błędów zaokrągleń.
(function (root) {
  'use strict';

  const STOP_RE = /^(ROZLICZENIE|SPRZEDA[ZŻ]\s*OPODAT|GOT[OÓ]WKA|KARTA|PŁATNO|PLATNO|RESZTA)/i;
  const SKIP_RE = /(PARAGON\s*FISKALNY|NIEFISKALNY|\bNIP\b|SPRZEDA[ZŻ]\s*OPODAT|\bPTU\b|KASJER|\bKASA\b|NR\s*SYS|\bBON\b|WYDRUK|^\s*\d{4}[-.]\d{2}[-.]\d{2})/i;
  const DISCOUNT_RE = /(RABAT|OPUST|PROMOCJA|ZNI[ZŻ]KA|UPUST)/i;

  // Kwota w formacie 12,34 / 12.34 / 1 234,56 (OCR czasem wstawia spacje).
  const PRICE = '-?\\d{1,5}(?:[ ]?\\d{3})*\\s?[.,]\\s?\\d{2}';
  const TRAILING_PRICE_RE = new RegExp('(' + PRICE + ')\\s*-?\\s*[A-Ga-g8]?\\s*[*]?\\s*$');
  const QTY_RE = new RegExp('(\\d+(?:[.,]\\d{1,3})?)\\s*(?:szt\\.?|kg|op\\.?)?\\s*[x×X*]\\s*(' + PRICE + ')');

  function toCents(str) {
    if (str == null) return NaN;
    const s = String(str).replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : Math.round(n * 100);
  }

  function normalizeLine(line) {
    return line
      .replace(/[|]/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanName(name) {
    return name
      .replace(/\s+[A-G]\s*$/, '')       // litera stawki PTU przed ilością
      .replace(/[=:*_.,\-\s]+$/, '')
      .replace(/^[\s\-*.,:]+/, '')
      .trim();
  }

  function parseReceipt(text) {
    const lines = String(text || '').split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const items = [];
    let total = null;
    let pendingName = '';
    let started = false;

    let ended = false;
    for (const line of lines) {
      if (/^SUMA\s*PTU/i.test(line) || /PTU/i.test(line) && /SUMA/i.test(line)) { if (items.length) ended = true; continue; }
      if (/^(SUMA|RAZEM|DO\s*ZAP)/i.test(line)) {
        const m = line.match(TRAILING_PRICE_RE);
        if (m && total == null) total = toCents(m[1]);
        if (items.length) ended = true;
        continue;
      }
      if (STOP_RE.test(line)) { if (items.length) ended = true; continue; }
      if (ended) continue; // po sumie szukamy już tylko kwoty SUMA
      if (/PARAGON\s*FISKALNY/i.test(line)) { started = true; pendingName = ''; continue; }
      if (SKIP_RE.test(line)) { pendingName = ''; continue; }

      const priceMatch = line.match(TRAILING_PRICE_RE);
      if (!priceMatch) {
        // Linia bez ceny – może być nazwą produktu, a cena jest w kolejnej linii.
        if (/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3,}/.test(line)) pendingName = line;
        continue;
      }

      let price = toCents(priceMatch[1]);
      if (isNaN(price)) continue;
      const before = line.slice(0, priceMatch.index);

      if (DISCOUNT_RE.test(line)) {
        if (price > 0) price = -price;
        if (items.length) {
          items[items.length - 1].price += price;
          items[items.length - 1].discount = (items[items.length - 1].discount || 0) + price;
        }
        pendingName = '';
        continue;
      }

      let name = before;
      let qty = 1;
      const q = before.match(QTY_RE);
      if (q) {
        name = before.slice(0, q.index);
        qty = parseFloat(q[1].replace(',', '.')) || 1;
      }
      name = cleanName(name);
      if (!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{2,}/.test(name)) {
        if (pendingName) name = cleanName(pendingName);
        else continue; // np. same liczby – szum
      }
      pendingName = '';
      if (price === 0) continue;
      started = true;
      items.push({ name, qty, price });
    }
    return { items, total, started };
  }

  const api = { parseReceipt, toCents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReceiptParser = api;
})(typeof self !== 'undefined' ? self : this);
