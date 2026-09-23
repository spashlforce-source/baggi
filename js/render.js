// ============================================================
// ГЛАВНЫЙ РЕНДЕР: гараж, склад, заказы, инструменты, логи
// ============================================================

import { state, techStatus } from './state.js';
import { esc, fmtDate, fmtDay, money, $, $$ } from './utils.js';

// Точка входа — определяет, что рендерить
export function render() {
  const titles = { garage: 'Гараж', warehouse: 'Склад', logs: 'Логи' };
  let title = titles[state.view];

  if (state.view === 'garage' && state.garageCat) {
    const c = state.categories.find(x => x.id === state.garageCat);
    title = c ? c.name : 'Гараж';
  }
  if (state.view === 'warehouse' && state.whCat) {
    if (state.whCat === '__none__') title = 'Универсальные';
    else {
      const c = state.categories.find(x => x.id === state.whCat);
      title = c ? c.name : 'Склад';
    }
  }
  $('#pageTitle').textContent = title;

  const showBack = (state.view === 'garage' && state.garageCat)
    || (state.view === 'warehouse' && state.whCat && state.whTab === 'parts');
  $('#backBtn').style.display = showBack ? 'flex' : 'none';

  $('#userLabel').textContent = state.emp.name;

  let showFab = false;
  if (state.view === 'garage') showFab = true;
  else if (state.view === 'warehouse' && state.whTab === 'parts' && state.whCat) showFab = true;
  else if (state.view === 'warehouse' && state.whTab === 'tools') showFab = true;
  $('#addBtn').style.display = showFab ? 'block' : 'none';

  $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));

  if (state.view === 'garage') renderGarage();
  else if (state.view === 'warehouse') renderWarehouse();
  else if (state.view === 'logs') renderLogs();
}

// ============ ГАРАЖ ============
function renderGarage() {
  if (!state.garageCat) renderGarageCategories();
  else renderGarageTechs();
}

function renderGarageCategories() {
  const q = state.search.toLowerCase();
  const cats = state.categories.filter(c => !q || c.name.toLowerCase().includes(q));
  const noCatCount = state.techs.filter(t => !t.category_id).length;

  let html = `<input class="search" id="searchInput" placeholder="Поиск категорий..." value="${esc(state.search)}">`;

  if (!cats.length && !noCatCount) {
    html += `<div class="empty">Пока нет категорий.<br>Нажми «+» чтобы создать.</div>`;
  } else {
    for (const c of cats) {
      const count = state.techs.filter(t => t.category_id === c.id).length;
      html += `<div class="card cat-card" data-cat="${c.id}"><h3>${esc(c.name)}</h3><span class="count">${count} шт</span></div>`;
    }
    if (noCatCount) {
      html += `<div class="card cat-card" data-cat="__none__"><h3 style="color:#888">Без категории</h3><span class="count">${noCatCount} шт</span></div>`;
    }
  }
  $('#content').innerHTML = html;

  const si = $('#searchInput');
  if (si) si.oninput = e => {
    state.search = e.target.value;
    const p = e.target.selectionStart;
    renderGarageCategories();
    const ni = $('#searchInput');
    if (ni) { ni.focus(); ni.setSelectionRange(p, p); }
  };

  $$('[data-cat]').forEach(el => el.onclick = () => {
    state.garageCat = el.dataset.cat === '__none__' ? '__none__' : el.dataset.cat;
    state.search = '';
    render();
  });
}

function renderGarageTechs() {
  const q = state.search.toLowerCase();
  let list;
  if (state.garageCat === '__none__') list = state.techs.filter(t => !t.category_id);
  else list = state.techs.filter(t => t.category_id === state.garageCat);
  list = list.filter(t => !q || t.name.toLowerCase().includes(q));

  const order = { repair: 0, free: 1 };
  list.sort((a, b) => (order[techStatus(a)] ?? 9) - (order[techStatus(b)] ?? 9) || a.name.localeCompare(b.name));

  let html = `<input class="search" id="searchInput" placeholder="Поиск техники..." value="${esc(state.search)}">`;

  if (!list.length) {
    html += `<div class="empty">Пока нет техники.<br>Нажми «+» чтобы добавить.</div>`;
  } else {
    for (const t of list) {
      const st = techStatus(t);
      const dot = st === 'repair' ? 'red' : 'green';
      const activeRepairs = state.repairs.filter(r => r.tech_id === t.id).length;
      html += `<div class="card" data-tech="${t.id}">
        <div class="tech-name-row">
          <span class="dot ${dot}"></span>
          <h3>${esc(t.name)}</h3>
        </div>
        ${activeRepairs ? `<div class="sub">Ремонтов: ${activeRepairs}</div>` : ''}
      </div>`;
    }
  }
  $('#content').innerHTML = html;

  const si = $('#searchInput');
  if (si) si.oninput = e => {
    state.search = e.target.value;
    const p = e.target.selectionStart;
    renderGarageTechs();
    const ni = $('#searchInput');
    if (ni) { ni.focus(); ni.setSelectionRange(p, p); }
  };

  $$('[data-tech]').forEach(el => el.onclick = () => {
    import('./modals.js').then(m => m.openTechModal(el.dataset.tech));
  });
}

// ============ СКЛАД ============
function renderWarehouse() {
  const tabsHtml = `<div class="tabs-top">
    <div class="tab-top ${state.whTab === 'parts' ? 'active' : ''}" id="tabParts">📦 Склад</div>
    <div class="tab-top ${state.whTab === 'orders' ? 'active' : ''}" id="tabOrders">🛒 Заказы</div>
    <div class="tab-top ${state.whTab === 'tools' ? 'active' : ''}" id="tabTools">🔧 Инструменты</div>
  </div>`;

  if (state.whTab === 'orders') { renderOrders(tabsHtml); return; }
  if (state.whTab === 'tools')  { renderTools(tabsHtml);  return; }

  if (!state.whCat) renderWarehouseCategories(tabsHtml);
  else renderWarehouseParts(tabsHtml);
}

function renderWarehouseCategories(tabsHtml) {
  const q = state.search.toLowerCase();
  const cats = state.categories.filter(c => !q || c.name.toLowerCase().includes(q));
  const universalCount = state.parts.filter(p => !p.category_ids || !p.category_ids.length).length;

  let html = tabsHtml;
  html += `<input class="search" id="searchInput" placeholder="Поиск категорий..." value="${esc(state.search)}">`;

  if (!cats.length && !universalCount) {
    html += `<div class="empty">Пока нет категорий.<br>Создай их в гараже.</div>`;
  } else {
    for (const c of cats) {
      const count = state.parts.filter(p => (p.category_ids || []).includes(c.id)).length;
      html += `<div class="card cat-card" data-whcat="${c.id}"><h3>${esc(c.name)}</h3><span class="count">${count} шт</span></div>`;
    }
    if (universalCount) {
      html += `<div class="card cat-card" data-whcat="__none__"><h3 style="color:#888">Универсальные</h3><span class="count">${universalCount} шт</span></div>`;
    }
  }
  $('#content').innerHTML = html;

  bindTabs();
  const si = $('#searchInput');
  if (si) si.oninput = e => {
    state.search = e.target.value;
    const p = e.target.selectionStart;
    renderWarehouse();
    const ni = $('#searchInput');
    if (ni) { ni.focus(); ni.setSelectionRange(p, p); }
  };
  $$('[data-whcat]').forEach(el => el.onclick = () => {
    state.whCat = el.dataset.whcat === '__none__' ? '__none__' : el.dataset.whcat;
    state.search = '';
    state.historyOpen = false;
    render();
  });
}

function renderWarehouseParts(tabsHtml) {
  const q = state.search.toLowerCase();
  let allParts;
  if (state.whCat === '__none__') allParts = state.parts.filter(p => !p.category_ids || !p.category_ids.length);
  else allParts = state.parts.filter(p => (p.category_ids || []).includes(state.whCat));
  allParts = allParts.filter(p => !q || p.name.toLowerCase().includes(q));

  // 📦 В наличии: есть на складе ИЛИ едет
  const inStock = allParts.filter(p => (p.in_stock || 0) > 0 || (p.ordered || 0) > 0);

  // 📜 История: ВСЕ, у кого есть хоть один заказ (даже если сейчас в наличии)
  const history = allParts.filter(p => state.orders.some(o => o.part_id === p.id));

  let html = tabsHtml;
  html += `<input class="search" id="searchInput" placeholder="Поиск запчастей..." value="${esc(state.search)}">`;

  if (!inStock.length) {
    html += `<div class="empty" style="padding:20px">В наличии ничего нет</div>`;
  } else {
    html += `<div class="section-title">📦 В наличии</div>`;
    for (const p of inStock) html += renderPartCard(p);
  }

  if (history.length) {
    html += `<div class="history-toggle ${state.historyOpen ? 'open' : ''}" id="historyToggle">
      <span>📜 История заказов (${history.length})</span>
      <span class="arrow">▼</span>
    </div>`;
    if (state.historyOpen) {
      for (const p of history) html += renderPartCard(p, true);
    }
  }

  $('#content').innerHTML = html;
  bindTabs();

  const si = $('#searchInput');
  if (si) si.oninput = e => {
    state.search = e.target.value;
    const pos = e.target.selectionStart;
    renderWarehouse();
    const ni = $('#searchInput');
    if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
  };
  $$('[data-part]').forEach(el => el.onclick = (e) => {
    if (e.target.closest('[data-pickup]')) return;
    import('./modals.js').then(m => m.openPartModal(el.dataset.part));
  });
  $$('[data-pickup]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    import('./modals.js').then(m => m.openPickupDialog(el.dataset.pickup));
  });

  const ht = $('#historyToggle');
  if (ht) ht.onclick = () => { state.historyOpen = !state.historyOpen; renderWarehouse(); };
}

function renderPartCard(p, isHistory = false) {
  const hasOrdered = (p.ordered || 0) > 0;
  const hasStock = (p.in_stock || 0) > 0;
  const lastOrder = isHistory
    ? state.orders.filter(o => o.part_id === p.id).sort((a, b) => new Date(b.ordered_at) - new Date(a.ordered_at))[0]
    : null;

  // В карточке истории — если есть наличие, показываем зелёным
  const stockLine = isHistory && hasStock
    ? `<span class="num-badge" style="background:#dcfce7;color:#166534">${p.in_stock} шт на складе</span>`
    : `<span class="num-badge ${hasStock ? '' : 'zero'}">${p.in_stock} шт</span>`;

  return `<div class="card" data-part="${p.id}">
    <h3>${esc(p.name)}</h3>
    <div style="margin-top:6px">
      ${stockLine}
      ${hasOrdered ? `<span class="num-badge ordered">заказано: ${p.ordered}</span>` : ''}
      ${p.price_unit && !isHistory ? `<span class="num-badge" style="background:#e5e7eb;color:#374151">${money(p.price_unit)}</span>` : ''}
    </div>
    ${isHistory && lastOrder ? `<div class="sub" style="margin-top:6px;font-size:12px">Последний заказ: ${money(lastOrder.total)}, ${esc(lastOrder.shop_label || '—')}, ${fmtDay(lastOrder.ordered_at)}</div>` : ''}
    ${hasOrdered ? `<div style="margin-top:10px"><button class="btn success small" data-pickup="${p.id}">🟢 Забрал</button></div>` : ''}
  </div>`;
}

// ============ ЗАКАЗЫ ============
function renderOrders(tabsHtml) {
  const filter = state.orderFilter;
  const now = new Date();
  let list = state.orders;

  if (filter === 'month') {
    const m = now.getMonth(), y = now.getFullYear();
    list = list.filter(o => {
      const d = new Date(o.ordered_at);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  } else if (filter === 'year') {
    list = list.filter(o => new Date(o.ordered_at).getFullYear() === now.getFullYear());
  }

  let html = tabsHtml;
  html += `<div class="filter-row">
    <div class="cat-chip ${filter === 'all' ? 'active' : ''}" data-of="all">Все</div>
    <div class="cat-chip ${filter === 'month' ? 'active' : ''}" data-of="month">Этот месяц</div>
    <div class="cat-chip ${filter === 'year' ? 'active' : ''}" data-of="year">Этот год</div>
  </div>`;

  if (!list.length) {
    html += `<div class="empty">Заказов пока нет.</div>`;
  } else {
    let total = 0;
    for (const o of list) {
      total += o.total || 0;
      const st = o.status === 'bought' ? '🟢 Куплено' : '🟡 Заказано';
      html += `<div class="order-row">
        <div class="info">
          <strong>${esc(o.part_name)}</strong> · ${o.qty} шт
          <div class="sub" style="color:#888;font-size:12px">${esc(o.shop_label || '—')} · ${fmtDate(o.ordered_at)} · ${esc(o.employee_name || '')}${o.bought_at ? `<br>Куплено: ${fmtDate(o.bought_at)}` : ''}</div>
          <div style="margin-top:4px;font-size:12px">${st}</div>
        </div>
        <div class="price">${money(o.total)}<div class="sub">${money(o.price)}/шт</div></div>
      </div>`;
    }
    html += `<div class="total-box"><span>Итого:</span><span>${money(total)}</span></div>`;
  }
  $('#content').innerHTML = html;
  bindTabs();
  $$('[data-of]').forEach(el => el.onclick = () => {
    state.orderFilter = el.dataset.of;
    renderOrders(tabsHtml);
  });
}

// ============ ИНСТРУМЕНТЫ ============
function renderTools(tabsHtml) {
  const q = state.search.toLowerCase();
  const list = state.tools.filter(t => !q || t.name.toLowerCase().includes(q));

  let html = tabsHtml;
  html += `<input class="search" id="searchInput" placeholder="Поиск инструментов..." value="${esc(state.search)}">`;

  if (!list.length) {
    html += `<div class="empty">Пока нет инструментов.<br>Нажми «+» чтобы добавить.</div>`;
  } else {
    for (const t of list) {
      html += `<div class="card" data-tool="${t.id}">
        <h3>${esc(t.name)}</h3>
        <div class="sub">Куплен: ${fmtDay(t.purchase_date)}${t.shop ? ' · ' + esc(t.shop) : ''}</div>
        ${t.price ? `<div style="margin-top:6px"><span class="num-badge" style="background:#e5e7eb;color:#374151">${money(t.price)}</span></div>` : ''}
      </div>`;
    }
  }
  $('#content').innerHTML = html;
  bindTabs();

  const si = $('#searchInput');
  if (si) si.oninput = e => {
    state.search = e.target.value;
    const p = e.target.selectionStart;
    renderTools(tabsHtml);
    const ni = $('#searchInput');
    if (ni) { ni.focus(); ni.setSelectionRange(p, p); }
  };
  $$('[data-tool]').forEach(el => el.onclick = () => {
    import('./modals.js').then(m => m.openToolForm(state.tools.find(t => t.id === el.dataset.tool)));
  });
}

// ============ ЛОГИ ============
function renderLogs() {
  if (!state.logs.length) {
    $('#content').innerHTML = `<div class="empty">Пока нет записей.</div>`;
    return;
  }
  let html = '';
  for (const l of state.logs) {
    html += `<div class="log-item">
      <div><span class="who">${esc(l.employee_name)}</span> — ${esc(l.description)}</div>
      <div class="time">${fmtDate(l.created_at)}</div>
    </div>`;
  }
  $('#content').innerHTML = html;
}

// ============ ОБЩЕЕ ============
function bindTabs() {
  const tp = $('#tabParts');
  const to = $('#tabOrders');
  const tt = $('#tabTools');
  if (tp) tp.onclick = () => { state.whTab = 'parts'; render(); };
  if (to) to.onclick = () => { state.whTab = 'orders'; render(); };
  if (tt) tt.onclick = () => { state.whTab = 'tools'; render(); };
}
