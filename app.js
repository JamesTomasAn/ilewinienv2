(function () {
  'use strict';
  const { parseReceipt, toCents } = window.ReceiptParser;
  const STORAGE_KEY = 'ilewinien-v1';
  const COLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)'];
  const $ = (id) => document.getElementById(id);

  let state = load() || {
    people: ['Osoba 1', 'Osoba 2', 'Osoba 3'],
    payer: 0,
    items: [],          // { id, name, qty, price (grosze), who: [bool,bool,bool] }
    receiptTotal: null, // grosze, z linii SUMA
    rawText: ''
  };
  let nextId = state.items.reduce((m, i) => Math.max(m, i.id), 0) + 1;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* tryb prywatny */ }
  }

  const fmt = (c) => (c / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
  const initials = (name, i) => String(i + 1);
  // Krótka etykieta na przycisk przypisania – imię (skrócone), żeby osoby było łatwo odróżnić.
  const shortName = (name, i) => {
    const n = (name || '').trim() || 'Osoba ' + (i + 1);
    return n.length > 10 ? n.slice(0, 9) + '…' : n;
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Osoby ----------
  function renderPeople() {
    $('people').innerHTML = state.people.map((p, i) => `
      <label class="person-input" style="--pc:${COLORS[i]}">
        <span class="dot">${escapeHtml(initials(p, i))}</span>
        <input type="text" value="${escapeHtml(p)}" data-i="${i}" maxlength="20" aria-label="Imię osoby ${i + 1}">
      </label>`).join('');
    $('people').querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        state.people[+inp.dataset.i] = inp.value;
        inp.previousElementSibling.textContent = initials(inp.value, +inp.dataset.i);
        save(); renderPayer(); renderBulk(); renderItems(); renderSummary();
      });
    });
    renderPayer();
    renderBulk();
  }
  function renderPayer() {
    $('payer').innerHTML = state.people.map((p, i) =>
      `<option value="${i}" ${state.payer === i ? 'selected' : ''}>${escapeHtml(p || 'Osoba ' + (i + 1))}</option>`).join('');
  }
  $('payer').addEventListener('change', (e) => { state.payer = +e.target.value; save(); renderSummary(); });

  function renderBulk() {
    $('bulk-buttons').innerHTML = state.people.map((p, i) =>
      `<button type="button" style="--pc:${COLORS[i]}" data-i="${i}">${escapeHtml(p || 'Osoba ' + (i + 1))}</button>`).join(' ');
    $('bulk-buttons').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      state.items.forEach((it) => { if (!it.who.some(Boolean)) it.who[+b.dataset.i] = true; });
      save(); renderItems(); renderSummary();
    }));
  }

  // ---------- Pozycje ----------
  function renderItems() {
    const list = $('items');
    $('empty-items').hidden = state.items.length > 0;
    list.innerHTML = state.items.map((it) => {
      const n = it.who.filter(Boolean).length;
      const share = n ? (n === 1 ? '' : `${n} × ${fmt(Math.round(it.price / n))}`) : 'nieprzypisane';
      return `
      <li class="item ${n ? '' : 'unassigned'}" data-id="${it.id}">
        <input class="name" type="text" value="${escapeHtml(it.name)}" aria-label="Nazwa">
        <input class="price" type="text" inputmode="decimal" value="${(it.price / 100).toFixed(2).replace('.', ',')}" aria-label="Cena">
        <button class="del" title="Usuń pozycję" aria-label="Usuń">×</button>
        <div class="who">
          ${state.people.map((p, i) => `<button type="button" class="toggle ${it.who[i] ? 'on' : ''}" style="--pc:${COLORS[i]}" data-i="${i}" title="${escapeHtml(p)}">${escapeHtml(shortName(p, i))}</button>`).join('')}
          <button type="button" class="toggle all" data-all="1" title="Wszyscy po równo">Wszyscy</button>
          ${it.qty && it.qty !== 1 ? `<span class="qty">ilość: ${String(it.qty).replace('.', ',')}</span>` : ''}
          <span class="share">${share}</span>
        </div>
      </li>`;
    }).join('');
    renderCheck();
  }

  function findItem(el) {
    const li = el.closest('.item');
    return li && state.items.find((i) => i.id === +li.dataset.id);
  }
  $('items').addEventListener('click', (e) => {
    const it = findItem(e.target);
    if (!it) return;
    if (e.target.classList.contains('del')) {
      state.items = state.items.filter((x) => x !== it);
    } else if (e.target.dataset.all) {
      const allOn = it.who.every(Boolean);
      it.who = it.who.map(() => !allOn);
    } else if (e.target.classList.contains('toggle')) {
      const i = +e.target.dataset.i;
      it.who[i] = !it.who[i];
    } else return;
    save(); renderItems(); renderSummary();
  });
  $('items').addEventListener('input', (e) => {
    const it = findItem(e.target);
    if (!it) return;
    if (e.target.classList.contains('name')) it.name = e.target.value;
    if (e.target.classList.contains('price')) {
      const c = toCents(e.target.value);
      it.price = isNaN(c) ? 0 : c;
      renderCheck(); renderSummary();
    }
    save();
  });
  $('items').addEventListener('change', (e) => {
    if (e.target.classList.contains('price')) renderItems(); // sformatuj cenę
  });

  $('add-item').addEventListener('click', () => {
    state.items.push({ id: nextId++, name: '', qty: 1, price: 0, who: [false, false, false] });
    save(); renderItems(); renderSummary();
    const inputs = $('items').querySelectorAll('.name');
    inputs[inputs.length - 1].focus();
  });
  $('clear').addEventListener('click', () => {
    if (!confirm('Usunąć wszystkie pozycje i odczytany tekst?')) return;
    state.items = []; state.receiptTotal = null; state.rawText = '';
    $('raw-text').value = '';
    $('preview-wrap').hidden = true;
    save(); renderItems(); renderSummary();
  });

  function renderCheck() {
    const el = $('check');
    const sum = state.items.reduce((s, i) => s + i.price, 0);
    if (!state.items.length) { el.textContent = ''; el.className = 'check'; return; }
    if (state.receiptTotal == null) {
      el.className = 'check';
      el.textContent = `Suma pozycji: ${fmt(sum)}`;
    } else if (state.receiptTotal === sum) {
      el.className = 'check ok';
      el.textContent = `✔ Suma pozycji (${fmt(sum)}) zgadza się z sumą na paragonie.`;
    } else {
      el.className = 'check warn';
      el.textContent = `⚠ Suma pozycji ${fmt(sum)} różni się od sumy z paragonu ${fmt(state.receiptTotal)} ` +
        `(różnica ${fmt(state.receiptTotal - sum)}). Sprawdź ceny lub dodaj brakującą pozycję.`;
    }
  }

  // ---------- Rozliczenie ----------
  function computeShares() {
    const shares = [0, 0, 0];
    let unassigned = 0;
    let rot = 0; // reszta z dzielenia groszy trafia do kolejnych osób na zmianę
    for (const it of state.items) {
      const who = [0, 1, 2].filter((i) => it.who[i]);
      if (!who.length) { unassigned += it.price; continue; }
      const base = Math.trunc(it.price / who.length);
      let rest = it.price - base * who.length;
      who.forEach((i) => { shares[i] += base; });
      const step = rest < 0 ? -1 : 1;
      while (rest !== 0) { shares[who[rot % who.length]] += step; rest -= step; rot++; }
    }
    return { shares, unassigned };
  }

  function renderSummary() {
    const { shares, unassigned } = computeShares();
    const name = (i) => escapeHtml(state.people[i] || 'Osoba ' + (i + 1));
    $('summary').innerHTML = shares.map((s, i) => `
      <div class="sum-box" style="--pc:${COLORS[i]}">
        <div><div class="n">${name(i)}</div><div class="c">${i === state.payer ? 'udział · zapłacił(a) ' + fmt(state.items.reduce((a, it) => a + it.price, 0)) : 'udział w zakupach'}</div></div>
        <div class="v">${fmt(s)}</div>
      </div>`).join('');

    const lines = [];
    shares.forEach((s, i) => {
      if (i === state.payer || s === 0) return;
      lines.push(`<p>${name(i)} oddaje <strong>${fmt(s)}</strong> dla ${name(state.payer)}</p>`);
    });
    if (!state.items.length) lines.push('<p>Dodaj pozycje, aby zobaczyć rozliczenie.</p>');
    else if (!lines.length && !unassigned) lines.push(`<p>Nikt nic nie oddaje – wszystko należy do ${name(state.payer)}.</p>`);
    if (unassigned) lines.push(`<p>⚠ Nieprzypisane pozycje na kwotę <strong>${fmt(unassigned)}</strong> – przypisz je, aby rozliczenie było pełne.</p>`);
    $('settle').innerHTML = lines.join('');
  }

  // ---------- Skanowanie (OCR) ----------
  let workerPromise = null;
  function getWorker() {
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker('pol', 1, {
        logger: (m) => {
          const labels = {
            'loading tesseract core': 'Ładowanie silnika OCR…',
            'initializing tesseract': 'Inicjalizacja…',
            'loading language traineddata': 'Pobieranie języka polskiego…',
            'initializing api': 'Przygotowanie…',
            'recognizing text': 'Odczytywanie tekstu…'
          };
          setProgress(m.progress || 0, labels[m.status] || m.status);
        }
      }).then(async (w) => {
        await w.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
        return w;
      }).catch((e) => { workerPromise = null; throw e; });
    }
    return workerPromise;
  }

  function setProgress(p, text) {
    $('progress-bar').style.width = Math.round(p * 100) + '%';
    if (text) $('progress-text').textContent = text + ' ' + Math.round(p * 100) + '%';
  }

  // Skalowanie + skala szarości + rozciągnięcie kontrastu poprawia skuteczność OCR.
  function preprocess(img) {
    const maxW = 1800, minW = 1200;
    let scale = 1;
    if (img.naturalWidth > maxW) scale = maxW / img.naturalWidth;
    else if (img.naturalWidth < minW) scale = minW / img.naturalWidth;
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = g; hist[g]++;
    }
    // odcięcie 1% najciemniejszych/najjaśniejszych pikseli
    const total = w * h, cut = total * 0.01;
    let lo = 0, hi = 255, acc = 0;
    while (lo < 255 && (acc += hist[lo]) < cut) lo++;
    acc = 0;
    while (hi > 0 && (acc += hist[hi]) < cut) hi--;
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / range));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  async function handleFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = $('preview');
    img.src = url;
    $('preview-wrap').hidden = false;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }).catch(() => null);
    if (!img.naturalWidth) { alert('Nie udało się wczytać zdjęcia.'); return; }

    $('progress-wrap').hidden = false;
    setProgress(0, 'Uruchamianie OCR…');
    setBusy(true);
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(preprocess(img));
      state.rawText = data.text;
      $('raw-text').value = data.text;
      applyParsed(data.text);
      setProgress(1, 'Gotowe!');
    } catch (err) {
      console.error(err);
      $('progress-text').textContent = 'Błąd odczytu: ' + (err && err.message ? err.message : err) +
        '. Sprawdź połączenie z internetem (silnik OCR pobiera się przy pierwszym użyciu).';
    } finally {
      setBusy(false);
    }
  }

  function applyParsed(text) {
    const { items, total } = parseReceipt(text);
    state.items = items.map((i) => ({ id: nextId++, name: i.name, qty: i.qty, price: i.price, who: [false, false, false] }));
    state.receiptTotal = total;
    save(); renderItems(); renderSummary();
    if (!items.length) {
      $('raw-wrap').open = true;
      alert('Nie udało się rozpoznać pozycji. Popraw tekst poniżej zdjęcia albo dodaj pozycje ręcznie.');
    }
  }

  function setBusy(b) {
    document.querySelectorAll('.scan-buttons .btn').forEach((el) => el.classList.toggle('disabled', b));
    $('camera-input').disabled = b; $('file-input').disabled = b;
  }

  ['camera-input', 'file-input'].forEach((id) => $(id).addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  }));
  $('reparse').addEventListener('click', () => {
    const hasAssignments = state.items.some((i) => i.who.some(Boolean));
    if (hasAssignments && !confirm('Zastąpić obecne pozycje (i przypisania) odczytanymi z tekstu?')) return;
    state.rawText = $('raw-text').value;
    applyParsed(state.rawText);
  });

  // ---------- Start ----------
  $('raw-text').value = state.rawText || '';
  renderPeople();
  renderItems();
  renderSummary();
})();
