/* ClearSpend – Smart Expense Tracker
   Vanilla JavaScript, Bootstrap 5, Chart.js. All data lives in localStorage. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */
  const STORAGE_KEY = 'clearspend.v1';

  const CATEGORIES = [
    { name: 'Food & Dining',   icon: 'cup-hot',          color: '#2563EB' },
    { name: 'Transportation',  icon: 'bus-front',        color: '#0F766E' },
    { name: 'Shopping',        icon: 'bag',              color: '#6366F1' },
    { name: 'Housing & Rent',  icon: 'house',            color: '#163B65' },
    { name: 'Utilities',       icon: 'lightning-charge', color: '#0EA5E9' },
    { name: 'Healthcare',      icon: 'heart-pulse',      color: '#14B8A6' },
    { name: 'Education',       icon: 'mortarboard',      color: '#1E40AF' },
    { name: 'Entertainment',   icon: 'film',             color: '#818CF8' },
    { name: 'Travel',          icon: 'airplane',         color: '#38BDF8' },
    { name: 'Personal Care',   icon: 'stars',            color: '#5EEAD4' },
    { name: 'Subscriptions',   icon: 'arrow-repeat',     color: '#0D9488' },
    { name: 'Other',           icon: 'three-dots',       color: '#94A3B8' }
  ];
  const CAT_NAMES = CATEGORIES.map(c => c.name);

  const CURRENCIES = {
    INR: { locale: 'en-IN' },
    USD: { locale: 'en-US' },
    EUR: { locale: 'en-IE' },
    GBP: { locale: 'en-GB' }
  };

  const VIEWS = {
    dashboard: 'Dashboard',
    add: 'Add Expense',
    transactions: 'Transactions',
    budgets: 'Budgets',
    analytics: 'Analytics',
    goals: 'Savings Goals',
    settings: 'Settings'
  };

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const round2 = n => Math.round(n * 100) / 100;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const num = v => (v === '' || v === null || v === undefined ? NaN : Number(v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayISO = () => toISO(new Date());
  const curMonthKey = () => todayISO().slice(0, 7);
  function parseISO(iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = parseISO(s);
    return toISO(d) === s && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
  }
  function shiftMonth(key, delta) {
    const p = key.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function daysIn(key) { const p = key.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
  function monthLabel(key, short) {
    const p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', short ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' });
  }
  function fmtDate(iso) { return parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function daysElapsed(key) { return key === curMonthKey() ? new Date().getDate() : daysIn(key); }

  /* ------------------------------------------------------------------ */
  /* State and persistence                                               */
  /* ------------------------------------------------------------------ */
  function defaultState() {
    return { version: 1, expenses: [], budget: 0, goals: [], settings: { name: 'Alex Morgan', currency: 'INR' }, isSample: false };
  }

  function sampleState() {
    const s = defaultState();
    s.isSample = true;
    s.budget = 55000;
    const T = [
      ['Monthly rent', 'Housing & Rent', 14500, 1, true],
      ['Electricity bill', 'Utilities', 1850, 4],
      ['Broadband plan', 'Utilities', 799, 5, true],
      ['Streaming subscription', 'Subscriptions', 499, 6, true],
      ['Cloud storage', 'Subscriptions', 130, 6, true],
      ['Weekly groceries', 'Food & Dining', 2150, 3],
      ['Weekly groceries', 'Food & Dining', 1980, 10],
      ['Weekly groceries', 'Food & Dining', 2240, 17],
      ['Weekly groceries', 'Food & Dining', 2050, 24],
      ['Lunch with friends', 'Food & Dining', 640, 8],
      ['Takeaway dinner', 'Food & Dining', 520, 15],
      ['Coffee and snacks', 'Food & Dining', 260, 12],
      ['Transit pass top-up', 'Transportation', 900, 2],
      ['Fuel refill', 'Transportation', 1400, 9],
      ['Cab ride home', 'Transportation', 380, 19],
      ['Pharmacy', 'Healthcare', 620, 11],
      ['Online course', 'Education', 1999, 7],
      ['Textbooks', 'Education', 850, 13],
      ['Movie night', 'Entertainment', 700, 14],
      ['Concert tickets', 'Entertainment', 1800, 21],
      ['Running shoes', 'Shopping', 3200, 16],
      ['Gift for a friend', 'Shopping', 950, 20],
      ['Haircut', 'Personal Care', 450, 18],
      ['Weekend getaway', 'Travel', 4800, 22]
    ];
    const factors = { 0: 1, '-1': 0.92, '-2': 1.06 };
    const now = new Date();
    const thisKey = curMonthKey();
    let seq = 0;
    [-2, -1, 0].forEach(off => {
      const key = shiftMonth(thisKey, off);
      T.forEach((t, i) => {
        if (off === -1 && i % 7 === 3) return;
        if (off === -2 && i % 6 === 5) return;
        const day = Math.min(t[3], daysIn(key));
        if (off === 0 && day > now.getDate()) return;
        const amount = t[4] ? t[2] : Math.round(t[2] * factors[off] / 10) * 10;
        s.expenses.push({ id: uid() + seq, title: t[0], amount: amount, category: t[1], date: key + '-' + pad(day), notes: '', createdAt: Date.now() + seq });
        seq++;
      });
    });
    const dl = new Date(); dl.setMonth(dl.getMonth() + 4);
    const dl2 = new Date(); dl2.setMonth(dl2.getMonth() + 2);
    s.goals = [
      { id: uid() + 'a', name: 'Emergency fund', target: 100000, saved: 42000, deadline: '' },
      { id: uid() + 'b', name: 'Laptop upgrade', target: 60000, saved: 38500, deadline: toISO(dl2) },
      { id: uid() + 'c', name: 'Weekend trip', target: 30000, saved: 9000, deadline: toISO(dl) }
    ];
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.expenses)) {
          const d = defaultState();
          const loaded = Object.assign(d, p, { settings: Object.assign(d.settings, p.settings || {}), goals: Array.isArray(p.goals) ? p.goals : [] });
          // Clear a previously saved profile name once, while keeping the user's other data.
          if (localStorage.getItem('clearspend.profile-name-cleared.v1') !== 'yes') {
            loaded.settings.name = '';
            localStorage.setItem('clearspend.profile-name-cleared.v1', 'yes');
          }
          return loaded;
        }
      }
    } catch (e) { /* fall through to sample data */ }
    return defaultState();
  }

  let saveWarned = false;
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) {
      if (!saveWarned) { saveWarned = true; toast('Your browser blocked saving. Changes will be lost on refresh.', 'danger'); }
    }
  }

  let state = load();

  const ui = {
    view: 'dashboard',
    month: curMonthKey(),
    page: 1,
    pageSize: 8,
    filters: { search: '', category: '', from: '', to: '', sort: 'newest' },
    activeCategory: null,
    chartType: 'doughnut'
  };

  /* ------------------------------------------------------------------ */
  /* Money formatting                                                    */
  /* ------------------------------------------------------------------ */
  let fmtInt, fmtDec, fmtCompact, curSymbol = '';
  function setFormatters() {
    const code = CURRENCIES[state.settings.currency] ? state.settings.currency : 'INR';
    const loc = CURRENCIES[code].locale;
    fmtInt = new Intl.NumberFormat(loc, { style: 'currency', currency: code, maximumFractionDigits: 0 });
    fmtDec = new Intl.NumberFormat(loc, { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    fmtCompact = new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 });
    const part = fmtInt.formatToParts(0).find(p => p.type === 'currency');
    curSymbol = part ? part.value : code;
  }
  function money(n) { const r = round2(n); return Number.isInteger(r) ? fmtInt.format(r) : fmtDec.format(r); }

  /* ------------------------------------------------------------------ */
  /* Calculations                                                        */
  /* ------------------------------------------------------------------ */
  function monthStats(key) {
    const list = state.expenses.filter(e => e.date.startsWith(key));
    return { list: list, total: round2(list.reduce((s, e) => s + e.amount, 0)), count: list.length };
  }
  const catMeta = name => CATEGORIES.find(c => c.name === name) || CATEGORIES[CATEGORIES.length - 1];

  function categoryTotals(list) {
    const map = new Map();
    list.forEach(e => {
      const r = map.get(e.category) || { name: e.category, total: 0, count: 0 };
      r.total += e.amount; r.count++; map.set(e.category, r);
    });
    const total = list.reduce((s, e) => s + e.amount, 0);
    return Array.from(map.values())
      .map(r => ({ name: r.name, count: r.count, total: round2(r.total), pct: total ? r.total / total * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }

  function budgetStatus(pct, has) {
    if (!has) return { key: 'none', label: 'No budget set' };
    if (pct >= 100) return { key: 'over', label: 'Over budget' };
    if (pct >= 90) return { key: 'critical', label: 'Near the limit' };
    if (pct >= 75) return { key: 'warn', label: 'Getting close' };
    return { key: 'normal', label: 'On track' };
  }
  const barClass = st => 'bar-' + (st.key === 'none' ? 'normal' : st.key);
  const chipClass = st => 'chip-' + (st.key === 'none' ? 'normal' : st.key);
  const msgClass = st => 'm-' + (st.key === 'none' ? 'normal' : st.key);

  /* ------------------------------------------------------------------ */
  /* Toasts and confirm dialog                                           */
  /* ------------------------------------------------------------------ */
  function toast(message, tone) {
    const host = $('#toastHost');
    const el = document.createElement('div');
    const icon = tone === 'danger' ? 'exclamation-circle' : tone === 'info' ? 'info-circle' : 'check-circle';
    el.className = 'toast align-items-center t-' + (tone || 'success');
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="toast-body"><i class="bi bi-' + icon + '"></i><span>' + esc(message) + '</span></div>';
    host.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3200 });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    t.show();
  }

  let confirmCb = null;
  function askConfirm(opts) {
    $('#confirmTitle').textContent = opts.title;
    $('#confirmMessage').textContent = opts.message;
    const ok = $('#confirmOk');
    ok.textContent = opts.okLabel || 'Confirm';
    confirmCb = opts.onOk;
    modal('confirmModal').show();
  }
  const modals = {};
  function modal(id) { return modals[id] || (modals[id] = new bootstrap.Modal(document.getElementById(id))); }

  /* ------------------------------------------------------------------ */
  /* Form helpers                                                        */
  /* ------------------------------------------------------------------ */
  function fieldError(input, msg) {
    input.classList.add('is-invalid');
    const fb = input.parentElement.querySelector('.invalid-feedback');
    if (fb) fb.textContent = msg;
  }
  function clearFieldErrors(form) { $$('.is-invalid', form).forEach(i => i.classList.remove('is-invalid')); }

  function expenseFormHTML(p) {
    const catOptions = CATEGORIES.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
    const secondary = p === 'm'
      ? '<button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>'
      : '<button type="button" class="btn btn-light" data-action="reset-form">Clear form</button>';
    return '' +
      '<form class="expense-form" data-prefix="' + p + '" novalidate>' +
        '<input type="hidden" name="id">' +
        '<div class="mb-3"><label class="form-label" for="' + p + '-title">Expense title</label>' +
          '<input class="form-control" id="' + p + '-title" name="title" maxlength="80" placeholder="e.g. Weekly groceries" autocomplete="off">' +
          '<div class="invalid-feedback"></div></div>' +
        '<div class="row g-3 mb-3">' +
          '<div class="col-sm-6"><label class="form-label" for="' + p + '-amount">Amount (<span class="cur-sym"></span>)</label>' +
            '<input class="form-control" id="' + p + '-amount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00">' +
            '<div class="invalid-feedback"></div></div>' +
          '<div class="col-sm-6"><label class="form-label" for="' + p + '-date">Date</label>' +
            '<input class="form-control" id="' + p + '-date" name="date" type="date" min="2000-01-01" max="2100-12-31">' +
            '<div class="invalid-feedback"></div></div>' +
        '</div>' +
        '<div class="mb-3"><label class="form-label" for="' + p + '-category">Category</label>' +
          '<select class="form-select" id="' + p + '-category" name="category"><option value="">Choose a category</option>' + catOptions + '</select>' +
          '<div class="invalid-feedback"></div></div>' +
        '<div class="mb-3"><label class="form-label" for="' + p + '-notes">Notes (optional)</label>' +
          '<textarea class="form-control" id="' + p + '-notes" name="notes" rows="2" maxlength="200" placeholder="Anything worth remembering"></textarea>' +
          '<div class="invalid-feedback"></div></div>' +
        '<div class="form-actions">' + secondary +
          '<button type="submit" class="btn btn-primary" data-submit>Add expense</button></div>' +
      '</form>';
  }

  const field = (form, name) => form.elements[name];

  function fillExpenseForm(form, e) {
    clearFieldErrors(form);
    field(form, 'id').value = e ? e.id : '';
    field(form, 'title').value = e ? e.title : '';
    field(form, 'amount').value = e ? e.amount : '';
    field(form, 'date').value = e ? e.date : todayISO();
    field(form, 'category').value = e ? e.category : '';
    field(form, 'notes').value = e ? (e.notes || '') : '';
    $('[data-submit]', form).textContent = e ? 'Save changes' : 'Add expense';
  }

  function readExpenseForm(form) {
    return {
      id: field(form, 'id').value,
      title: field(form, 'title').value.trim(),
      amount: num(field(form, 'amount').value),
      category: field(form, 'category').value,
      date: field(form, 'date').value,
      notes: field(form, 'notes').value.trim()
    };
  }

  function validateExpense(v) {
    const errs = {};
    if (!v.title) errs.title = 'Enter a title for this expense.';
    else if (v.title.length > 80) errs.title = 'Keep the title under 80 characters.';
    if (!Number.isFinite(v.amount)) errs.amount = 'Enter the amount you spent.';
    else if (v.amount <= 0) errs.amount = 'Amount must be greater than zero.';
    else if (v.amount > 1e9) errs.amount = 'That amount is too large.';
    if (!CAT_NAMES.includes(v.category)) errs.category = 'Choose a category.';
    if (!v.date) errs.date = 'Pick a date.';
    else if (!isValidDate(v.date)) errs.date = 'Enter a valid date between 2000 and 2100.';
    return errs;
  }

  let submitLock = false;
  function onExpenseSubmit(ev) {
    ev.preventDefault();
    if (submitLock) return;
    const form = ev.currentTarget;
    const v = readExpenseForm(form);
    const errs = validateExpense(v);
    clearFieldErrors(form);
    const keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach(k => fieldError(field(form, k), errs[k]));
      field(form, keys[0]).focus();
      return;
    }
    submitLock = true;
    const btn = $('[data-submit]', form);
    btn.disabled = true;
    try {
      const month = monthLabel(v.date.slice(0, 7));
      if (v.id) {
        const e = state.expenses.find(x => x.id === v.id);
        if (e) { e.title = v.title; e.amount = round2(v.amount); e.category = v.category; e.date = v.date; e.notes = v.notes; }
        toast('Expense updated');
      } else {
        state.expenses.push({ id: uid(), title: v.title, amount: round2(v.amount), category: v.category, date: v.date, notes: v.notes, createdAt: Date.now() });
        toast(v.date.slice(0, 7) === ui.month ? 'Expense added' : 'Expense added to ' + month);
      }
      save();
      if (form.dataset.prefix === 'm') modal('expenseModal').hide();
      else fillExpenseForm(form, null);
      renderAll();
    } finally {
      setTimeout(() => { submitLock = false; btn.disabled = false; }, 500);
    }
  }

  function openExpenseModal(id) {
    const form = $('#modalFormHost form');
    const e = id ? state.expenses.find(x => x.id === id) : null;
    fillExpenseForm(form, e);
    $('#expenseModalTitle').textContent = e ? 'Edit expense' : 'Add expense';
    modal('expenseModal').show();
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                              */
  /* ------------------------------------------------------------------ */
  const charts = {};
  function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }
  function drawChart(key, canvasId, cfg) {
    destroyChart(key);
    const el = document.getElementById(canvasId);
    if (!el) return;
    if (typeof Chart === 'undefined') {
      el.parentElement.innerHTML = '<p class="chart-note">Charts need an internet connection to load Chart.js.</p>';
      return;
    }
    charts[key] = new Chart(el, cfg);
  }

  const centerText = {
    id: 'centerText',
    afterDraw(chart, args, opts) {
      if (!opts || !opts.text) return;
      const a = chart.chartArea, ctx = chart.ctx;
      const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#64748B'; ctx.font = '600 12px Manrope, sans-serif';
      ctx.fillText(opts.label, x, y - 14);
      ctx.fillStyle = '#172B4D'; ctx.font = '800 21px Manrope, sans-serif';
      ctx.fillText(opts.text, x, y + 8);
      ctx.restore();
    }
  };

  function chartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "'Manrope', system-ui, sans-serif";
    Chart.defaults.color = '#64748B';
    Chart.defaults.plugins.tooltip.backgroundColor = '#163B65';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '700' };
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: shared chrome                                            */
  /* ------------------------------------------------------------------ */
  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'U';
  }

  function renderShared() {
    $('#pageTitle').textContent = VIEWS[ui.view];
    $('#todayText').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#profileName').textContent = state.settings.name || 'Welcome to ClearSpend';
    $('#avatar').textContent = state.settings.name ? initials(state.settings.name) : 'CS';
    $('#monthLabel').textContent = monthLabel(ui.month);
    $$('.cur-sym').forEach(s => { s.textContent = curSymbol; });

    // Sidebar budget summary
    const st = monthStats(ui.month);
    const has = state.budget > 0;
    const pct = has ? st.total / state.budget * 100 : 0;
    const status = budgetStatus(pct, has);
    $('#sideBudget').innerHTML = has
      ? '<div class="sb-top"><span>Budget used</span><span>' + Math.round(pct) + '%</span></div>' +
        '<div class="sb-value">' + money(st.total) + ' of ' + money(state.budget) + '</div>' +
        '<div class="bar"><div class="bar-fill ' + barClass(status) + '" style="width:' + Math.min(pct, 100) + '%"></div></div>'
      : '<div class="sb-top"><span>Monthly budget</span></div><div class="sb-value">Not set yet</div><div class="sb-top mb-0"><span>Tap to set one</span></div>';

    renderNotifications();
  }

  function buildNotifications() {
    const out = [];
    const key = curMonthKey();
    const st = monthStats(key);
    if (state.budget > 0) {
      const pct = st.total / state.budget * 100;
      const b = budgetStatus(pct, true);
      if (b.key === 'over') out.push({ tone: 'over', icon: 'exclamation-octagon', title: 'Over budget', text: 'You are ' + money(st.total - state.budget) + ' over your ' + monthLabel(key) + ' budget.' });
      else if (b.key === 'critical') out.push({ tone: 'critical', icon: 'exclamation-triangle', title: 'Near your budget limit', text: 'You have used ' + Math.floor(pct) + '% of this month\u2019s budget. ' + money(state.budget - st.total) + ' left.' });
      else if (b.key === 'warn') out.push({ tone: 'warn', icon: 'exclamation-triangle', title: 'Budget getting close', text: 'You have used ' + Math.floor(pct) + '% of this month\u2019s budget.' });
    } else {
      out.push({ tone: 'info', icon: 'wallet2', title: 'Set a monthly budget', text: 'A budget lets ClearSpend warn you before you overspend.' });
    }
    state.goals.forEach(g => {
      const p = g.target ? g.saved / g.target * 100 : 0;
      if (p >= 100) out.push({ tone: 'good', icon: 'trophy', title: 'Goal reached', text: g.name + ' is fully funded.' });
      else if (p >= 90) out.push({ tone: 'good', icon: 'piggy-bank', title: 'Almost there', text: g.name + ' is ' + Math.floor(p) + '% funded.' });
    });
    const today = todayISO();
    if (!state.expenses.some(e => e.date === today)) out.push({ tone: 'info', icon: 'journal-plus', title: 'Nothing logged today', text: 'Add today\u2019s expenses to keep your totals accurate.' });
    return out;
  }

  function renderNotifications() {
    const list = buildNotifications();
    $('#notifMenu').innerHTML = list.length
      ? list.map(n => '<li><div class="notif-item"><span class="notif-icon tone-' + n.tone + '"><i class="bi bi-' + n.icon + '"></i></span><div><strong>' + esc(n.title) + '</strong><span class="txt">' + esc(n.text) + '</span></div></div></li>').join('')
      : '<li class="p-3 text-secondary">You are all caught up.</li>';
    const count = list.filter(n => n.tone !== 'info').length;
    const badge = $('#bellBadge');
    badge.hidden = count === 0;
    badge.textContent = count;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: dashboard                                                */
  /* ------------------------------------------------------------------ */
  function txItemHTML(e) {
    const c = catMeta(e.category);
    return '<li class="tx-item">' +
      '<span class="cat-icon" style="--c:' + c.color + '"><i class="bi bi-' + c.icon + '"></i></span>' +
      '<div class="tx-main"><strong>' + esc(e.title) + '</strong><span>' + esc(e.category) + ', ' + fmtDate(e.date) + '</span></div>' +
      '<span class="tx-amt">' + money(e.amount) + '</span></li>';
  }

  function renderSampleBanner() {
    $('#sampleBanner').innerHTML = state.isSample
      ? '<div class="banner"><i class="bi bi-lightbulb"></i><p>You are looking at fictional sample data. Add your own expenses, or clear the sample data to start fresh.</p>' +
        '<button class="btn btn-sm btn-primary" type="button" data-action="clear-data">Clear sample data</button>' +
        '<button class="btn btn-sm btn-light" type="button" data-action="dismiss-sample">Dismiss</button></div>'
      : '';
  }

  function renderSummary() {
    const key = ui.month;
    const cur = monthStats(key);
    const prevKey = shiftMonth(key, -1);
    const prev = monthStats(prevKey);
    const budget = state.budget, has = budget > 0;
    const pct = has ? cur.total / budget * 100 : 0;
    const st = budgetStatus(pct, has);
    const remaining = round2(budget - cur.total);

    let delta;
    if (prev.total === 0) {
      delta = '<span class="delta flat">' + (cur.total === 0 ? 'No spending yet' : 'No data for ' + monthLabel(prevKey, true)) + '</span>';
    } else {
      const ch = (cur.total - prev.total) / prev.total * 100;
      const dir = ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat';
      delta = '<span class="delta ' + dir + '"><i class="bi bi-arrow-' + (ch > 0 ? 'up' : ch < 0 ? 'down' : 'right') + '-short"></i>' + Math.abs(ch).toFixed(1) + '%</span> vs ' + monthLabel(prevKey, true);
    }

    const avg = cur.total / daysElapsed(key);
    const goalsTarget = state.goals.reduce((s, g) => s + g.target, 0);
    const goalsSaved = state.goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0);
    const goalPct = goalsTarget ? goalsSaved / goalsTarget * 100 : 0;

    const hero = '<div class="hero-budget">' +
      '<div class="hero-head"><div><h2>Monthly budget</h2><p>' + monthLabel(key) + '</p></div>' +
      '<a class="btn btn-sm btn-ghost" href="#budgets">' + (has ? 'Edit budget' : 'Set budget') + '</a></div>' +
      '<div class="hero-figures">' +
        '<div><small>Budget</small><strong>' + (has ? money(budget) : 'Not set') + '</strong></div>' +
        '<div><small>Spent</small><strong>' + money(cur.total) + '</strong></div>' +
        '<div><small>' + (has && remaining < 0 ? 'Over by' : 'Remaining') + '</small><strong>' + (has ? money(Math.abs(remaining)) : '–') + '</strong></div>' +
      '</div>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(Math.round(pct), 100) + '" aria-label="Budget used"><div class="bar-fill ' + barClass(st) + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
      '<div class="hero-foot"><span>' + (has ? pct.toFixed(0) + '% of budget used' : 'Set a budget to track progress') + '</span><span class="chip ' + chipClass(st) + '">' + st.label + '</span></div>' +
    '</div>';

    const balClass = !has ? '' : remaining >= 0 ? 'is-positive' : 'is-negative';
    const balSub = !has ? '<a href="#budgets">Set a monthly budget</a>' : remaining >= 0 ? 'Left to spend this month' : 'Over budget this month';

    $('#summaryCards').innerHTML = '<div class="row g-3">' +
      '<div class="col-lg-4"><div class="panel stat"><div class="stat-label"><i class="bi bi-credit-card-2-front"></i>Total monthly expenses</div>' +
        '<div class="stat-value">' + money(cur.total) + '</div><div class="stat-sub">' + delta + '</div></div></div>' +
      '<div class="col-lg-8">' + hero + '</div>' +
      '<div class="col-sm-6 col-xl-3"><div class="panel stat"><div class="stat-label"><i class="bi bi-wallet2 is-teal"></i>Remaining balance</div>' +
        '<div class="stat-value ' + balClass + '">' + (has ? money(remaining) : '–') + '</div><div class="stat-sub">' + balSub + '</div></div></div>' +
      '<div class="col-sm-6 col-xl-3"><div class="panel stat"><div class="stat-label"><i class="bi bi-calendar-day"></i>Average daily spending</div>' +
        '<div class="stat-value">' + money(avg) + '</div><div class="stat-sub">Per day' + (key === curMonthKey() ? ' so far' : '') + ' in ' + monthLabel(key, true) + '</div></div></div>' +
      '<div class="col-sm-6 col-xl-3"><div class="panel stat"><div class="stat-label"><i class="bi bi-receipt"></i>Total transactions</div>' +
        '<div class="stat-value">' + cur.count + '</div><div class="stat-sub">' + state.expenses.length + ' records in total</div></div></div>' +
      '<div class="col-sm-6 col-xl-3"><div class="panel stat"><div class="stat-label"><i class="bi bi-piggy-bank is-teal"></i>Savings progress</div>' +
        (state.goals.length
          ? '<div class="stat-value is-positive">' + goalPct.toFixed(0) + '%</div><div class="bar mt-2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(goalPct) + '" aria-label="Savings progress"><div class="bar-fill bar-save" style="width:' + goalPct + '%"></div></div><div class="stat-sub">' + money(goalsSaved) + ' of ' + money(goalsTarget) + '</div>'
          : '<div class="stat-value">–</div><div class="stat-sub"><a href="#goals">Create a savings goal</a></div>') +
      '</div></div>' +
    '</div>';
  }

  function renderCategoryChart() {
    const key = ui.month;
    const totals = categoryTotals(monthStats(key).list);
    const total = round2(totals.reduce((s, r) => s + r.total, 0));
    $('#chartMonth').textContent = monthLabel(key);
    $$('[data-action="chart-type"]').forEach(b => b.classList.toggle('active', b.dataset.type === ui.chartType));

    const hasData = totals.length > 0;
    $('#chartWrap').parentElement.parentElement.hidden = !hasData;
    $('#chartEmpty').hidden = hasData;
    if (!hasData) { destroyChart('cat'); $('#chartLegend').innerHTML = ''; return; }

    $('#chartLegend').innerHTML = totals.map(r => {
      const c = catMeta(r.name);
      return '<li><button type="button" class="legend-row" data-action="select-category" data-cat="' + esc(r.name) + '" data-goto="1" title="See ' + esc(r.name) + ' in Analytics">' +
        '<span class="dot" style="background:' + c.color + '"></span><span class="legend-name">' + esc(r.name) + '</span>' +
        '<span class="legend-pct">' + r.pct.toFixed(1) + '%</span><span class="legend-amt">' + money(r.total) + '</span></button></li>';
    }).join('');

    const labels = totals.map(r => r.name);
    const isDoughnut = ui.chartType === 'doughnut';
    drawChart('cat', 'catChart', {
      type: ui.chartType,
      data: { labels: labels, datasets: [{ data: totals.map(r => r.total), backgroundColor: totals.map(r => catMeta(r.name).color), borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }] },
      plugins: [centerText],
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: isDoughnut ? '68%' : 0,
        plugins: {
          legend: { display: false },
          centerText: isDoughnut ? { label: 'Total spent', text: money(total) } : { text: '' },
          tooltip: {
            callbacks: {
              label: function (c) {
                const v = c.parsed;
                const pct = total ? (v / total * 100).toFixed(1) : '0.0';
                return ' ' + c.label + ': ' + money(v) + ' (' + pct + '%)';
              }
            }
          }
        },
        onHover: function (evt, els) { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        onClick: function (evt, els) {
          if (els.length) { ui.activeCategory = labels[els[0].index]; location.hash = '#analytics'; }
        }
      }
    });
  }

  function renderRecent() {
    const list = monthStats(ui.month).list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
    $('#recentList').innerHTML = list.length
      ? list.map(txItemHTML).join('')
      : '<li class="empty-state compact"><span class="empty-icon"><i class="bi bi-receipt"></i></span><h3>No transactions in ' + monthLabel(ui.month, true) + '</h3><p>Record an expense to see it here.</p><button class="btn btn-primary btn-sm" type="button" data-action="quick-add">Add expense</button></li>';
  }

  function renderDashboard() { renderSampleBanner(); renderSummary(); renderCategoryChart(); renderRecent(); }

  /* ------------------------------------------------------------------ */
  /* Rendering: add expense page                                         */
  /* ------------------------------------------------------------------ */
  function renderAddView() {
    const list = state.expenses.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
    $('#addRecent').innerHTML = list.length
      ? list.map(txItemHTML).join('')
      : '<li class="empty-state compact"><span class="empty-icon"><i class="bi bi-journal-plus"></i></span><h3>Nothing recorded yet</h3><p>Your first expense will show up here.</p></li>';
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: transactions                                             */
  /* ------------------------------------------------------------------ */
  function filteredExpenses() {
    const f = ui.filters;
    let list = state.expenses.slice();
    const q = f.search.trim().toLowerCase();
    if (q) list = list.filter(e => e.title.toLowerCase().includes(q));
    if (f.category) list = list.filter(e => e.category === f.category);
    if (f.from) list = list.filter(e => e.date >= f.from);
    if (f.to) list = list.filter(e => e.date <= f.to);
    const byDate = (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
    switch (f.sort) {
      case 'oldest': list.sort(byDate); break;
      case 'high': list.sort((a, b) => b.amount - a.amount || byDate(b, a)); break;
      case 'low': list.sort((a, b) => a.amount - b.amount || byDate(b, a)); break;
      default: list.sort((a, b) => byDate(b, a));
    }
    return list;
  }

  function pagerHTML(page, pages) {
    if (pages <= 1) return '';
    let end = Math.min(pages, Math.max(1, page - 2) + 4);
    let start = Math.max(1, end - 4);
    const item = (label, p, disabled, active, aria) =>
      '<li class="page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '') + '">' +
      '<button type="button" class="page-link" data-action="page" data-page="' + p + '"' + (disabled ? ' disabled' : '') + (aria ? ' aria-label="' + aria + '"' : '') + (active ? ' aria-current="page"' : '') + '>' + label + '</button></li>';
    let html = '<ul class="pagination pagination-sm mb-0 justify-content-center">' + item('&laquo;', page - 1, page === 1, false, 'Previous page');
    for (let p = start; p <= end; p++) html += item(p, p, false, p === page);
    return html + item('&raquo;', page + 1, page === pages, false, 'Next page') + '</ul>';
  }

  function renderTransactions() {
    const list = filteredExpenses();
    const pages = Math.max(1, Math.ceil(list.length / ui.pageSize));
    ui.page = Math.min(Math.max(1, ui.page), pages);
    const slice = list.slice((ui.page - 1) * ui.pageSize, ui.page * ui.pageSize);
    const total = round2(list.reduce((s, e) => s + e.amount, 0));
    const f = ui.filters;
    const backwards = f.from && f.to && f.from > f.to;

    $('#txMeta').innerHTML = '<span>Showing <strong>' + list.length + '</strong> of ' + state.expenses.length + ' expenses' +
      (backwards ? '. The start date is after the end date.' : '') + '</span><span>Total <strong>' + money(total) + '</strong></span>';

    $('#txBody').innerHTML = slice.map(e => {
      const c = catMeta(e.category);
      return '<tr>' +
        '<td><div class="tx-title">' + esc(e.title) + '</div>' + (e.notes ? '<div class="tx-note">' + esc(e.notes) + '</div>' : '') + '</td>' +
        '<td><span class="cat-pill" style="--c:' + c.color + '"><span class="dot"></span>' + esc(e.category) + '</span></td>' +
        '<td class="text-nowrap">' + fmtDate(e.date) + '</td>' +
        '<td class="text-end fw-bold text-nowrap">' + money(e.amount) + '</td>' +
        '<td class="text-end text-nowrap">' +
          '<button type="button" class="icon-btn in-table" data-action="edit-expense" data-id="' + e.id + '" aria-label="Edit ' + esc(e.title) + '" title="Edit"><i class="bi bi-pencil"></i></button>' +
          '<button type="button" class="icon-btn in-table danger" data-action="delete-expense" data-id="' + e.id + '" aria-label="Delete ' + esc(e.title) + '" title="Delete"><i class="bi bi-trash3"></i></button>' +
        '</td></tr>';
    }).join('');

    const empty = $('#txEmpty');
    if (list.length === 0) {
      empty.innerHTML = state.expenses.length === 0
        ? '<div class="empty-state"><span class="empty-icon"><i class="bi bi-receipt"></i></span><h3>No expenses yet</h3><p>Record your first expense and it will appear here.</p><button class="btn btn-primary" type="button" data-action="quick-add">Add your first expense</button></div>'
        : '<div class="empty-state"><span class="empty-icon"><i class="bi bi-search"></i></span><h3>No matching expenses</h3><p>Try a different search or clear the filters.</p><button class="btn btn-light" type="button" data-action="clear-filters">Clear filters</button></div>';
    } else empty.innerHTML = '';

    $('#txPager').innerHTML = pagerHTML(ui.page, pages);
  }

  function syncFilterInputs() {
    const f = ui.filters;
    $('#txSearch').value = f.search; $('#globalSearch').value = f.search;
    $('#txCategory').value = f.category; $('#txFrom').value = f.from; $('#txTo').value = f.to; $('#txSort').value = f.sort;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: budgets                                                  */
  /* ------------------------------------------------------------------ */
  function renderBudgets() {
    const key = ui.month;
    const st = monthStats(key);
    const has = state.budget > 0;
    const pct = has ? st.total / state.budget * 100 : 0;
    const status = budgetStatus(pct, has);
    const remaining = round2(state.budget - st.total);
    if (document.activeElement !== $('#budgetInput')) $('#budgetInput').value = has ? state.budget : '';

    const msgs = {
      none: ['info-circle', 'Set a monthly budget on the left to see how your spending compares.'],
      normal: ['check-circle', 'You are on track. ' + money(remaining) + ' left for ' + monthLabel(key) + '.'],
      warn: ['exclamation-triangle', 'You have used ' + Math.floor(pct) + '% of your budget. Keep an eye on bigger purchases.'],
      critical: ['exclamation-triangle', 'Only ' + money(remaining) + ' left. You are very close to your limit.'],
      over: ['exclamation-octagon', 'You are ' + money(Math.abs(remaining)) + ' over your budget for ' + monthLabel(key) + '.']
    }[status.key];

    let forecast = '';
    if (has && key === curMonthKey()) {
      const proj = st.total / daysElapsed(key) * daysIn(key);
      const left = daysIn(key) - new Date().getDate() + 1;
      forecast = '<div class="forecast"><div><small>Projected month-end spending</small><strong>' + money(proj) + '</strong></div>' +
        '<div><small>Daily allowance for the rest of the month</small><strong>' + (remaining > 0 ? money(remaining / left) : money(0)) + '</strong></div></div>';
    }

    $('#budgetStatus').innerHTML =
      '<div class="status-top"><div><h2 class="h5 fw-bold mb-1">' + monthLabel(key) + '</h2><p class="text-secondary mb-0">Budget progress</p></div><span class="chip ' + chipClass(status) + '">' + status.label + '</span></div>' +
      '<div class="big-pct">' + (has ? pct.toFixed(0) : '0') + '<small>%</small></div>' +
      '<div class="bar mt-3" style="height:14px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(Math.round(pct), 100) + '" aria-label="Budget used"><div class="bar-fill ' + barClass(status) + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
      '<div class="fig-grid"><div><small>Budget</small><strong>' + (has ? money(state.budget) : 'Not set') + '</strong></div>' +
        '<div><small>Spent</small><strong>' + money(st.total) + '</strong></div>' +
        '<div><small>' + (has && remaining < 0 ? 'Over by' : 'Remaining') + '</small><strong>' + (has ? money(Math.abs(remaining)) : '–') + '</strong></div></div>' +
      '<div class="status-msg ' + msgClass(status) + '"><i class="bi bi-' + msgs[0] + '"></i><span>' + msgs[1] + '</span></div>' + forecast;

    let rows = '';
    for (let i = 0; i < 6; i++) {
      const k = shiftMonth(ui.month, -i);
      const s = monthStats(k);
      const p = has ? s.total / state.budget * 100 : 0;
      const b = budgetStatus(p, has);
      rows += '<tr><td class="fw-bold">' + monthLabel(k) + '</td><td>' + money(s.total) + '</td><td>' + (has ? money(state.budget) : '–') + '</td>' +
        '<td style="min-width:160px">' + (has ? '<div class="d-flex align-items-center gap-2"><div class="bar flex-grow-1" style="height:8px"><div class="bar-fill ' + barClass(b) + '" style="width:' + Math.min(p, 100) + '%"></div></div><span class="fw-bold small">' + p.toFixed(0) + '%</span></div>' : '–') + '</td>' +
        '<td class="text-end"><span class="chip ' + chipClass(b) + '">' + b.label + '</span></td></tr>';
    }
    $('#budgetHistory').innerHTML = '<thead><tr><th>Month</th><th>Spent</th><th>Budget</th><th>Used</th><th class="text-end">Status</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: analytics                                                */
  /* ------------------------------------------------------------------ */
  function renderAnalytics() {
    const key = ui.month;
    const st = monthStats(key);
    const totals = categoryTotals(st.list);
    $('#dailyMonth').textContent = monthLabel(key);
    $('#catMonth').textContent = monthLabel(key) + ', highest to lowest';

    // Insights
    let biggest = null;
    st.list.forEach(e => { if (!biggest || e.amount > biggest.amount) biggest = e; });
    const byDay = {};
    st.list.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
    const busiest = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
    const tile = (icon, label, main, sub) => '<div class="col-md-4"><div class="panel insight"><span class="cat-icon"><i class="bi bi-' + icon + '"></i></span><div><small>' + label + '</small><strong>' + main + '</strong><span>' + sub + '</span></div></div></div>';
    $('#insightTiles').innerHTML =
      tile('arrow-up-right-circle', 'Largest expense', biggest ? esc(biggest.title) : 'No data yet', biggest ? money(biggest.amount) + ' on ' + fmtDate(biggest.date) : 'Nothing recorded in this month') +
      tile('pie-chart', 'Top category', totals[0] ? esc(totals[0].name) : 'No data yet', totals[0] ? money(totals[0].total) + ', ' + totals[0].pct.toFixed(0) + '% of spending' : 'Nothing recorded in this month') +
      tile('calendar-event', 'Busiest day', busiest ? fmtDate(busiest) : 'No data yet', busiest ? money(byDay[busiest]) + ' spent' : 'Nothing recorded in this month');

    // Trend chart
    const keys = [];
    for (let i = 5; i >= 0; i--) keys.push(shiftMonth(key, -i));
    const trendData = keys.map(k => monthStats(k).total);
    const datasets = [{ label: 'Spending', data: trendData, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.10)', fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: '#2563EB', borderWidth: 3 }];
    if (state.budget > 0) datasets.push({ label: 'Budget', data: keys.map(() => state.budget), borderColor: '#0F766E', borderDash: [6, 6], pointRadius: 0, fill: false, borderWidth: 2 });
    drawChart('trend', 'trendChart', {
      type: 'line',
      data: { labels: keys.map(k => monthLabel(k, true)), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: datasets.length > 1, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + money(c.parsed.y) } } },
        scales: { y: { beginAtZero: true, grid: { color: '#EEF2F7' }, border: { display: false }, ticks: { callback: v => fmtCompact.format(v) } }, x: { grid: { display: false }, border: { display: false } } }
      }
    });

    // Daily chart
    const n = daysIn(key);
    const daily = Array(n).fill(0);
    st.list.forEach(e => { daily[Number(e.date.slice(8, 10)) - 1] += e.amount; });
    drawChart('daily', 'dailyChart', {
      type: 'bar',
      data: { labels: daily.map((_, i) => i + 1), datasets: [{ label: 'Spent', data: daily.map(round2), backgroundColor: '#2563EB', borderRadius: 4, maxBarThickness: 18 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => i[0].label + ' ' + monthLabel(key, true), label: c => ' ' + money(c.parsed.y) } } },
        scales: { y: { beginAtZero: true, grid: { color: '#EEF2F7' }, border: { display: false }, ticks: { callback: v => fmtCompact.format(v) } }, x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 16 } } }
      }
    });

    // Category analysis
    const wrap = $('#catAnalysis');
    if (!totals.length) {
      wrap.innerHTML = '<div class="empty-state compact"><span class="empty-icon"><i class="bi bi-bar-chart"></i></span><h3>No spending to analyse</h3><p>Expenses recorded in ' + monthLabel(key) + ' appear here.</p></div>';
    } else {
      wrap.innerHTML = totals.map(r => {
        const c = catMeta(r.name);
        return '<button type="button" class="cat-row' + (ui.activeCategory === r.name ? ' selected' : '') + '" style="--c:' + c.color + '" data-action="select-category" data-cat="' + esc(r.name) + '" aria-pressed="' + (ui.activeCategory === r.name) + '">' +
          '<div class="cat-row-top"><span class="cat-icon"><i class="bi bi-' + c.icon + '"></i></span>' +
          '<div class="cat-row-name"><strong>' + esc(r.name) + '</strong><span>' + r.count + (r.count === 1 ? ' transaction' : ' transactions') + '</span></div>' +
          '<div class="cat-row-amt"><strong>' + money(r.total) + '</strong><span>' + r.pct.toFixed(1) + '%</span></div></div>' +
          '<div class="bar"><div class="bar-fill" style="width:' + r.pct + '%"></div></div></button>';
      }).join('');
    }

    // Selected category detail
    const detail = $('#catDetail');
    const active = ui.activeCategory;
    if (!active) {
      detail.innerHTML = '<div class="panel-head"><div><h2>Category transactions</h2><p>Select a category to see what is inside it</p></div></div>' +
        '<div class="empty-state compact"><span class="empty-icon"><i class="bi bi-hand-index"></i></span><h3>Nothing selected</h3><p>Pick a category from the breakdown.</p></div>';
    } else {
      const c = catMeta(active);
      const items = st.list.filter(e => e.category === active).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      detail.innerHTML = '<div class="panel-head"><div><h2>' + esc(active) + '</h2><p>' + items.length + (items.length === 1 ? ' transaction' : ' transactions') + ' in ' + monthLabel(key) + '</p></div>' +
        '<button type="button" class="btn btn-sm btn-light" data-action="select-category" data-cat="' + esc(active) + '">Clear</button></div>' +
        (items.length
          ? '<ul class="tx-list">' + items.slice(0, 8).map(txItemHTML).join('') + '</ul>' +
            '<button type="button" class="btn btn-light w-100 mt-3" data-action="open-category-tx">Open in Transactions</button>'
          : '<div class="empty-state compact"><span class="empty-icon" style="color:' + c.color + '"><i class="bi bi-' + c.icon + '"></i></span><h3>No spending here</h3><p>' + esc(active) + ' has no expenses in ' + monthLabel(key) + '.</p></div>');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: savings goals                                            */
  /* ------------------------------------------------------------------ */
  function renderGoals() {
    const target = state.goals.reduce((s, g) => s + g.target, 0);
    const saved = state.goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0);
    const pct = target ? saved / target * 100 : 0;
    $('#goalsOverview').innerHTML = state.goals.length
      ? '<div class="status-top"><div><h2 class="h5 fw-bold mb-1">Overall progress</h2><p class="text-secondary mb-0">Across ' + state.goals.length + (state.goals.length === 1 ? ' goal' : ' goals') + '</p></div><span class="chip chip-save">' + pct.toFixed(0) + '% saved</span></div>' +
        '<div class="bar" style="height:14px"><div class="bar-fill bar-save" style="width:' + pct + '%"></div></div>' +
        '<div class="fig-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:0"><div><small>Saved</small><strong>' + money(saved) + '</strong></div><div><small>Target</small><strong>' + money(target) + '</strong></div></div>'
      : '<div class="empty-state compact"><span class="empty-icon"><i class="bi bi-piggy-bank"></i></span><h3>No savings goals yet</h3><p>Set a goal, then add to it whenever you save.</p></div>';

    const now = parseISO(todayISO());
    $('#goalsGrid').innerHTML = state.goals.length ? state.goals.map(g => {
      const p = g.target ? g.saved / g.target * 100 : 0;
      const done = p >= 100;
      let when = 'No target date';
      if (g.deadline) {
        const left = Math.round((parseISO(g.deadline) - now) / 86400000);
        when = fmtDate(g.deadline) + (done ? '' : left > 0 ? ', ' + left + ' days left' : left === 0 ? ', due today' : ', target date passed');
      }
      return '<div class="col-md-6 col-xl-4"><div class="goal-card">' +
        '<div class="goal-head"><div><h3>' + esc(g.name) + '</h3><p>' + when + '</p></div>' +
          '<div class="d-flex"><button type="button" class="icon-btn sm" data-action="edit-goal" data-id="' + g.id + '" aria-label="Edit ' + esc(g.name) + '"><i class="bi bi-pencil"></i></button>' +
          '<button type="button" class="icon-btn sm danger" data-action="delete-goal" data-id="' + g.id + '" aria-label="Delete ' + esc(g.name) + '"><i class="bi bi-trash3"></i></button></div></div>' +
        '<div class="goal-amounts"><strong>' + money(g.saved) + '</strong><span>of ' + money(g.target) + '</span></div>' +
        '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(Math.round(p), 100) + '" aria-label="' + esc(g.name) + ' progress"><div class="bar-fill bar-save" style="width:' + Math.min(p, 100) + '%"></div></div>' +
        '<div class="goal-foot"><span class="chip ' + (done ? 'chip-save' : 'chip-normal') + '">' + (done ? 'Goal reached' : Math.floor(p) + '% saved') + '</span>' +
          '<button type="button" class="btn btn-sm btn-light" data-action="contribute" data-id="' + g.id + '"><i class="bi bi-plus-lg me-1"></i>Add savings</button></div>' +
      '</div></div>';
    }).join('') : '';
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: settings                                                 */
  /* ------------------------------------------------------------------ */
  function renderSettings() {
    if (document.activeElement !== $('#setName')) $('#setName').value = state.settings.name;
    $('#setCurrency').value = state.settings.currency;
  }

  /* ------------------------------------------------------------------ */
  /* Render orchestration and routing                                    */
  /* ------------------------------------------------------------------ */
  function renderView() {
    switch (ui.view) {
      case 'dashboard': renderDashboard(); break;
      case 'add': renderAddView(); break;
      case 'transactions': renderTransactions(); break;
      case 'budgets': renderBudgets(); break;
      case 'analytics': renderAnalytics(); break;
      case 'goals': renderGoals(); break;
      case 'settings': renderSettings(); break;
    }
  }
  function renderAll() { renderShared(); renderView(); }

  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarBackdrop').classList.remove('show'); }

  function route() {
    const v = (location.hash || '#dashboard').slice(1);
    const changed = VIEWS[v] && v !== ui.view;
    ui.view = VIEWS[v] ? v : 'dashboard';
    $$('.view').forEach(sec => { sec.hidden = sec.id !== 'view-' + ui.view; });
    $$('.nav-item').forEach(a => {
      const on = a.dataset.view === ui.view;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (ui.view === 'transactions') syncFilterInputs();
    closeSidebar();
    renderAll();
    if (changed) window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Goals, settings and data actions                                    */
  /* ------------------------------------------------------------------ */
  function openGoalModal(id) {
    const g = id ? state.goals.find(x => x.id === id) : null;
    const form = $('#goalForm');
    clearFieldErrors(form);
    $('#goalId').value = g ? g.id : '';
    $('#goalName').value = g ? g.name : '';
    $('#goalTarget').value = g ? g.target : '';
    $('#goalSaved').value = g ? g.saved : 0;
    $('#goalDeadline').value = g ? g.deadline || '' : '';
    $('#goalModalTitle').textContent = g ? 'Edit savings goal' : 'New savings goal';
    $('#goalSubmit').textContent = g ? 'Save changes' : 'Create goal';
    modal('goalModal').show();
  }

  function onGoalSubmit(ev) {
    ev.preventDefault();
    const form = ev.currentTarget;
    clearFieldErrors(form);
    const name = $('#goalName').value.trim();
    const target = num($('#goalTarget').value);
    const saved = num($('#goalSaved').value || '0');
    const deadline = $('#goalDeadline').value;
    let bad = null;
    const fail = (el, msg) => { fieldError(el, msg); if (!bad) bad = el; };
    if (!name) fail($('#goalName'), 'Give your goal a name.');
    if (!Number.isFinite(target) || target <= 0) fail($('#goalTarget'), 'Enter a target greater than zero.');
    else if (target > 1e9) fail($('#goalTarget'), 'That amount is too large.');
    if (!Number.isFinite(saved) || saved < 0) fail($('#goalSaved'), 'Saved amount cannot be negative.');
    if (deadline && !isValidDate(deadline)) fail($('#goalDeadline'), 'Enter a valid date.');
    if (bad) { bad.focus(); return; }
    const id = $('#goalId').value;
    if (id) {
      const g = state.goals.find(x => x.id === id);
      if (g) { g.name = name; g.target = round2(target); g.saved = round2(saved); g.deadline = deadline; }
      toast('Goal updated');
    } else {
      state.goals.push({ id: uid(), name: name, target: round2(target), saved: round2(saved), deadline: deadline });
      toast('Goal created');
    }
    save(); modal('goalModal').hide(); renderAll();
  }

  function onContributeSubmit(ev) {
    ev.preventDefault();
    const input = $('#contributeAmount');
    clearFieldErrors(ev.currentTarget);
    const amt = num(input.value);
    if (!Number.isFinite(amt) || amt <= 0) { fieldError(input, 'Enter an amount greater than zero.'); input.focus(); return; }
    const g = state.goals.find(x => x.id === $('#contributeId').value);
    if (g) {
      g.saved = round2(g.saved + amt);
      save(); modal('contributeModal').hide(); renderAll();
      toast(g.saved >= g.target ? g.name + ' reached its target' : 'Added ' + money(amt) + ' to ' + g.name);
    }
  }

  function onBudgetSubmit(ev) {
    ev.preventDefault();
    const input = $('#budgetInput');
    clearFieldErrors(ev.currentTarget);
    const v = num(input.value);
    if (!Number.isFinite(v) || v <= 0) { fieldError(input, 'Enter a budget greater than zero.'); input.focus(); return; }
    if (v > 1e9) { fieldError(input, 'That amount is too large.'); input.focus(); return; }
    state.budget = round2(v);
    save(); renderAll(); toast('Budget saved');
  }

  function onSettingsSubmit(ev) {
    ev.preventDefault();
    const nameEl = $('#setName');
    clearFieldErrors(ev.currentTarget);
    const name = nameEl.value.trim();
    if (!name) { fieldError(nameEl, 'Enter a name to show in the top bar.'); nameEl.focus(); return; }
    state.settings.name = name;
    state.settings.currency = CURRENCIES[$('#setCurrency').value] ? $('#setCurrency').value : 'INR';
    setFormatters(); save(); renderAll(); toast('Settings saved');
  }

  function clearAllData() {
    state = defaultState();
    state.isSample = false;
    save(); renderAll(); toast('All data cleared', 'info');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clearspend-backup-' + todayISO() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded', 'info');
  }

  function sanitizeImport(obj) {
    if (!obj || !Array.isArray(obj.expenses)) throw new Error('This file does not look like a ClearSpend backup.');
    const d = defaultState();
    d.expenses = obj.expenses.map((e, i) => ({
      id: uid() + i,
      title: String((e && e.title) || '').trim().slice(0, 80),
      amount: round2(Number(e && e.amount)),
      category: CAT_NAMES.includes(e && e.category) ? e.category : 'Other',
      date: String((e && e.date) || ''),
      notes: String((e && e.notes) || '').slice(0, 200),
      createdAt: Number(e && e.createdAt) || Date.now() + i
    })).filter(e => e.title && Number.isFinite(e.amount) && e.amount > 0 && isValidDate(e.date));
    d.budget = Number.isFinite(Number(obj.budget)) && Number(obj.budget) > 0 ? round2(Number(obj.budget)) : 0;
    d.goals = (Array.isArray(obj.goals) ? obj.goals : []).map((g, i) => ({
      id: uid() + 'g' + i,
      name: String((g && g.name) || '').trim().slice(0, 60),
      target: round2(Number(g && g.target)),
      saved: round2(Math.max(0, Number(g && g.saved) || 0)),
      deadline: g && isValidDate(g.deadline) ? g.deadline : ''
    })).filter(g => g.name && Number.isFinite(g.target) && g.target > 0);
    const s = obj.settings || {};
    d.settings.name = String(s.name || d.settings.name).trim().slice(0, 40) || d.settings.name;
    d.settings.currency = CURRENCIES[s.currency] ? s.currency : d.settings.currency;
    return d;
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onerror = () => toast('Could not read that file.', 'danger');
    reader.onload = () => {
      let next;
      try { next = sanitizeImport(JSON.parse(reader.result)); }
      catch (e) { toast(e.message && e.message.indexOf('ClearSpend') >= 0 ? e.message : 'That file is not valid JSON.', 'danger'); return; }
      askConfirm({
        title: 'Import this backup?',
        message: 'This replaces your current data with ' + next.expenses.length + ' expenses and ' + next.goals.length + ' goals from the file.',
        okLabel: 'Import backup',
        onOk: () => { state = next; setFormatters(); save(); renderAll(); toast('Backup imported'); }
      });
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  function openCategoryTransactions() {
    ui.filters = { search: '', category: ui.activeCategory || '', from: ui.month + '-01', to: ui.month + '-' + pad(daysIn(ui.month)), sort: 'newest' };
    ui.page = 1;
    location.hash = '#transactions';
  }

  function bindEvents() {
    document.addEventListener('click', ev => {
      const el = ev.target.closest('[data-action]');
      if (!el) return;
      const id = el.dataset.id;
      switch (el.dataset.action) {
        case 'quick-add': openExpenseModal(); break;
        case 'edit-expense': openExpenseModal(id); break;
        case 'delete-expense': {
          const e = state.expenses.find(x => x.id === id);
          if (!e) break;
          askConfirm({
            title: 'Delete this expense?',
            message: '\u201C' + e.title + '\u201D (' + money(e.amount) + ') will be removed. This cannot be undone.',
            okLabel: 'Delete expense',
            onOk: () => { state.expenses = state.expenses.filter(x => x.id !== id); save(); renderAll(); toast('Expense deleted'); }
          });
          break;
        }
        case 'page': ui.page = Number(el.dataset.page); renderTransactions(); break;
        case 'clear-filters': $('#txClear').click(); break;
        case 'reset-form': fillExpenseForm($('#pageFormHost form'), null); break;
        case 'chart-type': ui.chartType = el.dataset.type; renderCategoryChart(); break;
        case 'select-category':
          ui.activeCategory = (ui.activeCategory === el.dataset.cat && !el.dataset.goto) ? null : el.dataset.cat;
          if (el.dataset.goto) location.hash = '#analytics'; else renderAnalytics();
          break;
        case 'open-category-tx': openCategoryTransactions(); break;
        case 'new-goal': openGoalModal(); break;
        case 'edit-goal': openGoalModal(id); break;
        case 'delete-goal': {
          const g = state.goals.find(x => x.id === id);
          if (!g) break;
          askConfirm({
            title: 'Delete this goal?',
            message: '\u201C' + g.name + '\u201D and its saved amount will be removed.',
            okLabel: 'Delete goal',
            onOk: () => { state.goals = state.goals.filter(x => x.id !== id); save(); renderAll(); toast('Goal deleted'); }
          });
          break;
        }
        case 'contribute': {
          const g = state.goals.find(x => x.id === id);
          if (!g) break;
          clearFieldErrors($('#contributeForm'));
          $('#contributeId').value = g.id;
          $('#contributeAmount').value = '';
          $('#contributeTitle').textContent = 'Add savings to ' + g.name;
          modal('contributeModal').show();
          break;
        }
        case 'dismiss-sample': state.isSample = false; save(); renderDashboard(); break;
        case 'clear-data':
          askConfirm({ title: 'Clear all data?', message: 'This removes every expense, goal and budget from this browser. Export a backup first if you want to keep a copy.', okLabel: 'Clear all data', onOk: clearAllData });
          break;
      }
    });

    // Clear validation state as the user edits a field
    document.addEventListener('input', ev => { if (ev.target.classList && ev.target.classList.contains('is-invalid')) ev.target.classList.remove('is-invalid'); });
    document.addEventListener('change', ev => { if (ev.target.classList && ev.target.classList.contains('is-invalid')) ev.target.classList.remove('is-invalid'); });

    // Forms
    $$('.expense-form').forEach(f => f.addEventListener('submit', onExpenseSubmit));
    $('#goalForm').addEventListener('submit', onGoalSubmit);
    $('#contributeForm').addEventListener('submit', onContributeSubmit);
    $('#budgetForm').addEventListener('submit', onBudgetSubmit);
    $('#settingsForm').addEventListener('submit', onSettingsSubmit);
    $('#budgetRemove').addEventListener('click', () => {
      if (!state.budget) { toast('No budget to remove', 'info'); return; }
      state.budget = 0; save(); renderAll(); toast('Budget removed', 'info');
    });

    // Modals
    $('#confirmOk').addEventListener('click', () => {
      const cb = confirmCb; confirmCb = null;
      modal('confirmModal').hide();
      if (cb) cb();
    });
    $('#expenseModal').addEventListener('shown.bs.modal', () => field($('#modalFormHost form'), 'title').focus());
    $('#goalModal').addEventListener('shown.bs.modal', () => $('#goalName').focus());
    $('#contributeModal').addEventListener('shown.bs.modal', () => $('#contributeAmount').focus());

    // Top bar
    $('#quickAdd').addEventListener('click', () => openExpenseModal());
    $('#menuBtn').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#sidebarBackdrop').classList.add('show'); });
    $('#sidebarBackdrop').addEventListener('click', closeSidebar);
    $('#monthPrev').addEventListener('click', () => { ui.month = shiftMonth(ui.month, -1); renderAll(); });
    $('#monthNext').addEventListener('click', () => { ui.month = shiftMonth(ui.month, 1); renderAll(); });
    $('#monthLabel').addEventListener('click', () => { ui.month = curMonthKey(); renderAll(); });

    // Search and filters
    $('#globalSearch').addEventListener('input', ev => {
      ui.filters.search = ev.target.value; ui.page = 1; $('#txSearch').value = ev.target.value;
      if (ui.view !== 'transactions') location.hash = '#transactions'; else renderTransactions();
    });
    $('#txSearch').addEventListener('input', ev => { ui.filters.search = ev.target.value; ui.page = 1; $('#globalSearch').value = ev.target.value; renderTransactions(); });
    $('#txCategory').addEventListener('change', ev => { ui.filters.category = ev.target.value; ui.page = 1; renderTransactions(); });
    $('#txFrom').addEventListener('change', ev => { ui.filters.from = ev.target.value; ui.page = 1; renderTransactions(); });
    $('#txTo').addEventListener('change', ev => { ui.filters.to = ev.target.value; ui.page = 1; renderTransactions(); });
    $('#txSort').addEventListener('change', ev => { ui.filters.sort = ev.target.value; ui.page = 1; renderTransactions(); });
    $('#txClear').addEventListener('click', () => {
      ui.filters = { search: '', category: '', from: '', to: '', sort: 'newest' }; ui.page = 1;
      syncFilterInputs(); renderTransactions();
    });

    // Data tools
    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', ev => { const f = ev.target.files[0]; if (f) importData(f); ev.target.value = ''; });
    $('#sampleBtn').addEventListener('click', () => askConfirm({
      title: 'Load sample data?', message: 'This replaces your current data with fictional sample data.', okLabel: 'Load sample data',
      onOk: () => { state = sampleState(); setFormatters(); save(); renderAll(); toast('Sample data loaded', 'info'); }
    }));
    $('#clearBtn').addEventListener('click', () => askConfirm({
      title: 'Clear all data?', message: 'This removes every expense, goal and budget from this browser. Export a backup first if you want to keep a copy.', okLabel: 'Clear all data', onOk: clearAllData
    }));

    window.addEventListener('hashchange', route);
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */
  function init() {
    setFormatters();
    chartDefaults();

    $('#txCategory').insertAdjacentHTML('beforeend', CATEGORIES.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join(''));
    $('#pageFormHost').innerHTML = expenseFormHTML('p');
    $('#modalFormHost').innerHTML = expenseFormHTML('m');
    fillExpenseForm($('#pageFormHost form'), null);
    fillExpenseForm($('#modalFormHost form'), null);

    bindEvents();
    save();
    route();
  }

  init();
})();
