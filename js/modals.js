// ============================================================
// ВСЕ МОДАЛКИ: техника, ремонт, запчасть, заказ, инструмент, категория
// ============================================================

import { sb } from './config.js';
import { state, loadAll, addLog } from './state.js';
import { esc, fmtDate, money, $, $$ } from './utils.js';
import { render } from './render.js';

// ============ БАЗОВЫЕ МОДАЛКИ ============
export function openModal(title, html, onMount, nested = false) {
  const root = nested ? $('#modalRoot2') : $('#modalRoot');
  const cls = nested ? 'modal-bg nested' : 'modal-bg';
  root.innerHTML = `<div class="${cls}"><div class="modal"><h3>${esc(title)}</h3><div id="modalBody">${html}</div></div></div>`;
  root.querySelector('.modal-bg').onclick = e => {
    if (e.target.classList.contains('modal-bg')) closeModal(nested);
  };
  onMount?.();
}

export function closeModal(nested = false) {
  if (nested) $('#modalRoot2').innerHTML = '';
  else { $('#modalRoot').innerHTML = ''; $('#modalRoot2').innerHTML = ''; }
}

// ============ КАТЕГОРИИ ============
export function openCategoryForm(cat) {
  const isNew = !cat;
  const title = isNew ? 'Новая категория' : 'Категория: ' + cat.name;
  let html = `<label>Название</label><input id="c_name" value="${esc(cat?.name || '')}">`;
  html += `<div class="modal-actions">
    ${!isNew ? '<button class="btn danger" id="delBtn">Удалить</button>' : ''}
    <button class="btn secondary" id="cancelBtn">Отмена</button>
    <button class="btn" id="saveBtn">Сохранить</button></div>`;

  openModal(title, html, () => {
    $('#cancelBtn').onclick = () => closeModal();
    $('#saveBtn').onclick = async () => {
      const name = $('#c_name').value.trim();
      if (!name) { alert('Введи название'); return; }
      if (isNew) {
        const { error } = await sb.from('categories').insert({ name });
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('add_category', `Добавил категорию: ${name}`, 'category');
      } else {
        const { error } = await sb.from('categories').update({ name }).eq('id', cat.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('edit_category', `Изменил категорию: ${name}`, 'category', cat.id);
      }
      await loadAll(); render(); closeModal();
    };
    if (!isNew) {
      $('#delBtn').onclick = async () => {
        const usedByTechs = state.techs.filter(t => t.category_id === cat.id);
        const usedByParts = state.parts.filter(p => (p.category_ids || []).includes(cat.id));
        if (usedByTechs.length || usedByParts.length) {
          const msgs = [];
          if (usedByTechs.length) msgs.push(`техники: ${usedByTechs.map(t => t.name).join(', ')}`);
          if (usedByParts.length) msgs.push(`запчастей: ${usedByParts.map(p => p.name).join(', ')}`);
          alert('Нельзя удалить категорию — она используется:\n' + msgs.join('\n'));
          return;
        }
        if (!confirm(`Удалить категорию «${cat.name}»?`)) return;
        const { error } = await sb.from('categories').delete().eq('id', cat.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('del_category', `Удалил категорию: ${cat.name}`, 'category', cat.id);
        await loadAll(); render(); closeModal();
      };
    }
  });
}

// ============ ТЕХНИКА ============
export function addTech() { openTechForm(null); }
export function openTechModal(id) { openTechForm(state.techs.find(t => t.id === id)); }

function openTechForm(t) {
  const isNew = !t;
  const title = isNew ? 'Новая техника' : 'Техника: ' + t.name;
  const presetCat = isNew && state.garageCat && state.garageCat !== '__none__'
    ? state.garageCat : (t?.category_id || '');

  let html = `
    <label>Название</label><input id="f_name" value="${esc(t?.name || '')}" placeholder="Например: Снегоход Буран синий">
    <label>Категория</label>
    <select id="f_category">
      <option value="">— Без категории —</option>
      ${state.categories.map(c => `<option value="${c.id}" ${presetCat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <label>Заметки</label><textarea id="f_notes">${esc(t?.notes || '')}</textarea>`;

  if (!isNew) {
    const { techStatus } = window.__rentalState || {};
    const stFn = techStatus || (() => 'free');
    const st = state.repairs.some(r => r.tech_id === t.id && r.status === 'in_progress') ? 'repair' : 'free';
    const stLabel = st === 'repair' ? '🔴 В ремонте' : '🟢 На ходу';
    html += `<div style="margin-top:14px;padding:10px 12px;background:#f3f4f6;border-radius:8px;font-size:13px">Статус: <strong>${stLabel}</strong> <span style="color:#888;font-size:11px">(автоматически)</span></div>`;

    html += `<div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        <strong>Ремонты</strong>
        <button class="btn small" id="addRepairBtn">+ Добавить ремонт</button>
      </div>
      <div id="repairsList"></div>
    </div>`;
  }
  html += `<div class="modal-actions">
    ${!isNew ? '<button class="btn danger" id="delBtn">Удалить</button>' : ''}
    <button class="btn secondary" id="cancelBtn">Отмена</button>
    <button class="btn" id="saveBtn">Сохранить</button></div>`;

  openModal(title, html, () => {
    $('#cancelBtn').onclick = () => closeModal();
    $('#saveBtn').onclick = async () => {
      const obj = {
        name: $('#f_name').value.trim(),
        category_id: $('#f_category').value || null,
        notes: $('#f_notes').value.trim()
      };
      if (!obj.name) { alert('Введи название'); return; }
      if (isNew) {
        const { data, error } = await sb.from('techs').insert(obj).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('add_tech', `Добавил технику: ${obj.name}`, 'tech', data.id);
      } else {
        const { error } = await sb.from('techs').update(obj).eq('id', t.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('edit_tech', `Изменил технику: ${obj.name}`, 'tech', t.id);
      }
      await loadAll(); render(); closeModal();
    };
    if (!isNew) {
      $('#delBtn').onclick = async () => {
        if (!confirm('Удалить технику? Все ремонты тоже удалятся.')) return;
        const { error } = await sb.from('techs').delete().eq('id', t.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('del_tech', `Удалил технику: ${t.name}`, 'tech', t.id);
        await loadAll(); render(); closeModal();
      };
      $('#addRepairBtn').onclick = () => openRepairForm(t, null);
      renderRepairsList(t.id);
    }
  });
}

function renderRepairsList(techId) {
  const box = $('#repairsList');
  if (!box) return;
  const list = state.repairs.filter(r => r.tech_id === techId);
  if (!list.length) { box.innerHTML = `<div class="sub" style="color:#999">Пока нет ремонтов</div>`; return; }
  box.innerHTML = list.map(r => renderRepairCard(r)).join('');
  box.querySelectorAll('[data-edit-repair]').forEach(btn => btn.onclick = () => {
    const tech = state.techs.find(t => t.id === techId);
    openRepairForm(tech, state.repairs.find(x => x.id === btn.dataset.editRepair));
  });
}

function renderRepairCard(r) {
  const parts = state.repairParts.filter(rp => rp.repair_id === r.id);
  const stLabel = r.status === 'completed' ? '🟢 Завершено' : '🔵 В процессе';
  const stClass = r.status === 'completed' ? 'done' : 'progress';
  const partsHtml = parts.length
    ? `<div class="parts-list">${parts.map(p => `<div class="part-line"><span>• ${esc(p.part_name)} × ${p.qty}<span class="t ${p.type}">${p.type === 'installed' ? 'установлено' : 'заказано'}</span></span></div>`).join('')}</div>`
    : '';
  const commentHtml = r.comment ? `<div class="comment">${esc(r.comment)}</div>` : '';

  return `<div class="repair-card">
    <div class="hdr">
      <span class="status-lbl ${stClass}">${stLabel}</span>
      <span style="color:#888;font-size:11px">${fmtDate(r.created_at)}</span>
    </div>
    ${commentHtml}
    ${partsHtml}
    <div class="meta">${esc(r.employee_name)}${r.completed_at ? ` · завершён ${fmtDate(r.completed_at)}` : ''}</div>
    <div class="actions">
      <button class="btn small secondary" data-edit-repair="${r.id}">Открыть</button>
    </div>
  </div>`;
}

// ============ РЕМОНТ ============
function openRepairForm(tech, repair) {
  const isNew = !repair;
  const title = isNew ? 'Новый ремонт: ' + tech.name : 'Ремонт: ' + tech.name;
  const curStatus = repair?.status || 'in_progress';

  let html = `
    <label>Что делал</label>
    <textarea id="r_comment" placeholder="Опиши, что было сделано">${esc(repair?.comment || '')}</textarea>

    <label>Запчасти в ремонте</label>
    <div id="r_parts"></div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <button class="btn small" id="r_installBtn">+ Установить со склада</button>
      <button class="btn small secondary" id="r_orderBtn">+ Заказать запчасть</button>
    </div>

    <label>Статус</label>
    <div class="status-picker">
      <div class="status-opt ${curStatus === 'in_progress' ? 'active' : ''}" data-rs="in_progress"><span class="dot blue"></span> В процессе</div>
      <div class="status-opt ${curStatus === 'completed' ? 'active' : ''}" data-rs="completed"><span class="dot green"></span> Завершено</div>
    </div>
  `;

  html += `<div class="modal-actions">
    ${!isNew ? '<button class="btn danger" id="r_delBtn">Удалить ремонт</button>' : ''}
    <button class="btn secondary" id="r_cancel">Отмена</button>
    <button class="btn" id="r_save">Сохранить</button>
  </div>`;

  let tempParts = [];
  if (repair?.id) tempParts = state.repairParts.filter(rp => rp.repair_id === repair.id).map(rp => ({ ...rp }));

  openModal(title, html, () => {
    let st = curStatus;

    const renderParts = () => {
      const box = $('#r_parts');
      if (!box) return;
      if (!tempParts.length) {
        box.innerHTML = `<div class="sub" style="color:#999;font-size:12px">Пока нет запчастей</div>`;
        return;
      }
      box.innerHTML = tempParts.map((p, i) => `<div class="repair-part-item">
        <span>${esc(p.part_name)} × ${p.qty}<span class="t ${p.type}">${p.type === 'installed' ? 'установлено' : 'заказано'}</span></span>
        <button class="btn small danger" data-rm="${i}" style="padding:2px 8px;font-size:12px">×</button>
      </div>`).join('');
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
        tempParts.splice(+b.dataset.rm, 1);
        renderParts();
      });
    };
    renderParts();

    $$('.status-opt').forEach(el => el.onclick = () => {
      st = el.dataset.rs;
      $$('.status-opt').forEach(x => x.classList.toggle('active', x === el));
    });

    $('#r_installBtn').onclick = () => openRepairAddPart(tech, (added) => {
      tempParts.push(added); renderParts();
    });
    $('#r_orderBtn').onclick = () => openRepairOrderPart(tech, (added) => {
      tempParts.push(added); renderParts();
    });

    $('#r_cancel').onclick = () => closeModal();

    if (!isNew) {
      $('#r_delBtn').onclick = async () => {
        if (!confirm('Удалить ремонт? Установленные запчасти вернутся на склад.')) return;
        const parts = state.repairParts.filter(rp => rp.repair_id === repair.id && rp.type === 'installed');
        for (const rp of parts) {
          const p = state.parts.find(x => x.id === rp.part_id);
          if (p) await sb.from('parts').update({ in_stock: (p.in_stock || 0) + rp.qty }).eq('id', p.id);
        }
        await sb.from('repairs').delete().eq('id', repair.id);
        await addLog('del_repair', `Удалил ремонт техники «${tech.name}»`, 'tech', tech.id);
        await loadAll(); render();
        closeModal();
        openTechModal(tech.id);
      };
    }

    $('#r_save').onclick = async () => {
      const comment = $('#r_comment').value.trim();

      if (isNew) {
        const { data: newRepair, error } = await sb.from('repairs').insert({
          tech_id: tech.id, comment, status: st,
          employee_id: state.emp.id, employee_name: state.emp.name,
          completed_at: st === 'completed' ? new Date().toISOString() : null
        }).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }

        for (const p of tempParts) {
          await sb.from('repair_parts').insert({
            repair_id: newRepair.id, part_id: p.part_id, part_name: p.part_name,
            qty: p.qty, type: p.type, order_id: p.order_id || null,
            employee_id: state.emp.id, employee_name: state.emp.name
          });
        }
        await addLog('add_repair', `Создал ремонт техники «${tech.name}»`, 'tech', tech.id);
      } else {
        const oldParts = state.repairParts.filter(rp => rp.repair_id === repair.id);
        const newIds = tempParts.filter(x => x.id).map(x => x.id);
        for (const op of oldParts) {
          if (!newIds.includes(op.id)) {
            if (op.type === 'installed') {
              const p = state.parts.find(x => x.id === op.part_id);
              if (p) await sb.from('parts').update({ in_stock: (p.in_stock || 0) + op.qty }).eq('id', p.id);
            }
            await sb.from('repair_parts').delete().eq('id', op.id);
          }
        }
        const { error } = await sb.from('repairs').update({
          comment, status: st,
          completed_at: st === 'completed' ? new Date().toISOString() : null
        }).eq('id', repair.id);
        if (error) { alert('Ошибка: ' + error.message); return; }

        for (const p of tempParts) {
          if (!p.id) {
            await sb.from('repair_parts').insert({
              repair_id: repair.id, part_id: p.part_id, part_name: p.part_name,
              qty: p.qty, type: p.type, order_id: p.order_id || null,
              employee_id: state.emp.id, employee_name: state.emp.name
            });
          }
        }
        await addLog('edit_repair', `Изменил ремонт техники «${tech.name}»`, 'tech', tech.id);
      }

      await loadAll(); render();
      closeModal();
      openTechModal(tech.id);
    };
  });
}

function openRepairAddPart(tech, onAdd) {
  const list = state.parts.filter(p => {
    if ((p.in_stock || 0) <= 0) return false;
    if (!p.category_ids || !p.category_ids.length) return true;
    if (!tech.category_id) return false;
    return p.category_ids.includes(tech.category_id);
  });

  let html = '';
  if (!list.length) {
    html = `<div class="empty">Нет подходящих запчастей в наличии.</div>`;
  } else {
    html = `<label>Запчасть</label>
      <select id="ra_part">${list.map(p => `<option value="${p.id}">${esc(p.name)} (${p.in_stock} шт)</option>`).join('')}</select>
      <label>Количество</label>
      <div class="qty-row">
        <button class="btn secondary" id="raMinus">−</button>
        <input id="ra_qty" type="number" value="1" min="1">
        <button class="btn secondary" id="raPlus">+</button>
      </div>`;
  }
  html += `<div class="modal-actions">
    <button class="btn secondary" id="raCancel">Отмена</button>
    ${list.length ? '<button class="btn" id="raDo">Добавить</button>' : ''}
  </div>`;

  openModal('Установить запчасть', html, () => {
    $('#raCancel').onclick = () => closeModal(true);
    if (list.length) {
      $('#raMinus').onclick = () => { const i = $('#ra_qty'); i.value = Math.max(1, (+i.value || 1) - 1); };
      $('#raPlus').onclick  = () => { const i = $('#ra_qty'); i.value = (+i.value || 1) + 1; };
      $('#raDo').onclick = async () => {
        const partId = $('#ra_part').value;
        const qty = Math.max(1, parseInt($('#ra_qty').value) || 1);
        const part = state.parts.find(p => p.id === partId);
        if (!part) return;
        if (qty > (part.in_stock || 0)) { alert('Недостаточно на складе'); return; }
        await sb.from('parts').update({ in_stock: (part.in_stock || 0) - qty }).eq('id', part.id);
        part.in_stock = (part.in_stock || 0) - qty;
        onAdd({ part_id: part.id, part_name: part.name, qty, type: 'installed' });
        closeModal(true);
      };
    }
  }, true);
}

function openRepairOrderPart(tech, onAdd) {
  const catName = tech.category_id ? (state.categories.find(c => c.id === tech.category_id)?.name || '') : '';

  let html = `<div class="radio-row">
    <div class="radio-opt active" id="roNew">Создать новую</div>
    <div class="radio-opt" id="roPick">Выбрать со склада</div>
  </div>
  <div id="roNewBlock">
    <label>Название</label><input id="ro_name" placeholder="Например, Ремень вариатора">
    <label>Количество</label>
    <div class="qty-row">
      <button class="btn secondary" id="roMinus">−</button>
      <input id="ro_qty" type="number" value="1" min="1">
      <button class="btn secondary" id="roPlus">+</button>
    </div>
    <label>Цена за штуку, ₽</label><input id="ro_price" type="number" min="0" value="0">
    <label>Магазин</label><input id="ro_shop" placeholder="Ozon">
    ${catName ? `<div class="fixed-cat">Категория: <strong>${esc(catName)}</strong></div>` : '<div class="fixed-cat">Без категории</div>'}
  </div>
  <div id="roPickBlock" style="display:none">
    <label>Выберите запчасть со склада</label>
    <div id="roPickList"></div>
    <div id="roPickForm" style="display:none">
      <label>Количество</label>
      <div class="qty-row">
        <button class="btn secondary" id="ropMinus">−</button>
        <input id="rop_qty" type="number" value="1" min="1">
        <button class="btn secondary" id="ropPlus">+</button>
      </div>
      <label>Цена за штуку, ₽</label><input id="rop_price" type="number" min="0" value="0">
      <label>Магазин</label><input id="rop_shop" placeholder="Ozon">
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn secondary" id="roCancel">Отмена</button>
    <button class="btn" id="roDo">Заказать</button>
  </div>`;

  openModal('Заказать запчасть', html, () => {
    let mode = 'new';
    let picked = null;

    const setMode = (m) => {
      mode = m;
      $('#roNew').classList.toggle('active', m === 'new');
      $('#roPick').classList.toggle('active', m === 'pick');
      $('#roNewBlock').style.display = m === 'new' ? 'block' : 'none';
      $('#roPickBlock').style.display = m === 'pick' ? 'block' : 'none';
    };
    $('#roNew').onclick = () => setMode('new');
    $('#roPick').onclick = () => setMode('pick');

    const bindQty = (m, p, i) => {
      $(m).onclick = () => { const el = $(i); el.value = Math.max(1, (+el.value || 1) - 1); };
      $(p).onclick = () => { const el = $(i); el.value = (+el.value || 1) + 1; };
    };
    bindQty('#roMinus', '#roPlus', '#ro_qty');
    bindQty('#ropMinus', '#ropPlus', '#rop_qty');

    const partsList = state.parts.filter(p => {
      if (tech.category_id) {
        if (!p.category_ids || !p.category_ids.length) return true;
        return p.category_ids.includes(tech.category_id);
      }
      return true;
    });

    if (partsList.length) {
      $('#roPickList').innerHTML = partsList.map(p => `<div class="cat-item" data-ropick="${p.id}" style="cursor:pointer;padding:10px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px">
        <div><div><strong>${esc(p.name)}</strong></div><div class="sub" style="font-size:12px;color:#888">В наличии: ${p.in_stock} шт</div></div>
      </div>`).join('');
      $$('[data-ropick]').forEach(el => el.onclick = () => {
        picked = state.parts.find(p => p.id === el.dataset.ropick);
        $$('[data-ropick]').forEach(x => x.style.background = '');
        el.style.background = '#eff6ff';
        $('#roPickForm').style.display = 'block';
        $('#rop_price').value = picked.price_unit || 0;
      });
    } else {
      $('#roPickList').innerHTML = `<div class="sub" style="color:#999">Нет запчастей</div>`;
    }

    $('#roCancel').onclick = () => closeModal(true);
    $('#roDo').onclick = async () => {
      if (mode === 'new') {
        const name = $('#ro_name').value.trim();
        if (!name) { alert('Введи название'); return; }
        const qty = Math.max(1, parseInt($('#ro_qty').value) || 1);
        const price = Math.max(0, parseInt($('#ro_price').value) || 0);
        const shop = $('#ro_shop').value.trim();

        const catIds = tech.category_id ? [tech.category_id] : [];
        const { data: newPart, error: e1 } = await sb.from('parts').insert({
          name, in_stock: 0, ordered: qty, price_unit: price, notes: '', category_ids: catIds
        }).select().single();
        if (e1) { alert('Ошибка: ' + e1.message); return; }

        const { data: order, error: e2 } = await sb.from('orders').insert({
          part_id: newPart.id, part_name: name,
          shop_label: shop, shop_url: '',
          qty, price, total: qty * price,
          status: 'ordered',
          employee_id: state.emp.id, employee_name: state.emp.name
        }).select().single();
        if (e2) { alert('Ошибка заказа: ' + e2.message); return; }

        await addLog('order', `Заказал «${name}» (${qty} шт × ${money(price)}) для ремонта техники «${tech.name}»`, 'tech', tech.id);
        state.parts.push(newPart);
        onAdd({ part_id: newPart.id, part_name: name, qty, type: 'ordered', order_id: order.id });
      } else {
        if (!picked) { alert('Выбери запчасть'); return; }
        const qty = Math.max(1, parseInt($('#rop_qty').value) || 1);
        const price = Math.max(0, parseInt($('#rop_price').value) || 0);
        const shop = $('#rop_shop').value.trim();

        const { data: order, error } = await sb.from('orders').insert({
          part_id: picked.id, part_name: picked.name,
          shop_label: shop, shop_url: '',
          qty, price, total: qty * price,
          status: 'ordered',
          employee_id: state.emp.id, employee_name: state.emp.name
        }).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }

        await sb.from('parts').update({ ordered: (picked.ordered || 0) + qty, price_unit: price }).eq('id', picked.id);
        picked.ordered = (picked.ordered || 0) + qty;
        await addLog('order', `Заказал «${picked.name}» (${qty} шт × ${money(price)}) для ремонта техники «${tech.name}»`, 'tech', tech.id);
        onAdd({ part_id: picked.id, part_name: picked.name, qty, type: 'ordered', order_id: order.id });
      }
      closeModal(true);
    };
  }, true);
}

// ============ ЗАПЧАСТЬ ============
export function addPart() { openPartForm(null); }
export function openPartModal(id) { openPartForm(state.parts.find(p => p.id === id)); }

function openPartForm(p) {
  const isNew = !p;
  const title = isNew ? 'Новая запчасть' : 'Запчасть: ' + p.name;
  const pCats = p?.category_ids || [];
  const presetCat = isNew && state.whCat && state.whCat !== '__none__' ? state.whCat : null;
  const fixedCat = isNew && state.whCat && state.whCat !== '__none__' ? state.categories.find(c => c.id === state.whCat) : null;

  let html = `
    <label>Название</label><input id="p_name" value="${esc(p?.name || '')}">
    <label>В наличии</label><input id="p_stock" type="number" min="0" value="${p?.in_stock ?? 0}">
    <label>Ориентировочная цена, ₽ (за штуку)</label>
    <input id="p_price" type="number" min="0" value="${p?.price_unit ?? 0}">
    <label>Заказано (едет)</label><input id="p_ordered" type="number" min="0" value="${p?.ordered ?? 0}">
    <label>Заметки</label><textarea id="p_notes">${esc(p?.notes || '')}</textarea>
    <label>Ссылки на магазины</label>
    <div id="linksBox"></div>
    ${!isNew ? `<button class="btn secondary small" id="addLinkBtn" style="margin-top:4px">+ Добавить ссылку</button>` : '<div class="sub" style="color:#999;font-size:12px;margin-top:4px">Можно добавить после сохранения</div>'}`;

  if (isNew) {
    if (fixedCat) {
      html += `<label>Категория</label><div class="fixed-cat">Запчасть будет привязана к: <strong>${esc(fixedCat.name)}</strong></div>`;
    } else {
      html += `<label>Категория</label><div class="fixed-cat">Без категории (универсальная) — можно изменить после сохранения</div>`;
    }
  } else {
    const catNames = pCats.map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean);
    const catText = catNames.length ? catNames.join(', ') : 'Универсальная (без категории)';
    html += `<label>Категория</label>
      <div class="cat-view">
        <span class="val">${esc(catText)}</span>
        <button class="btn small secondary" id="changeCatBtn">Изменить</button>
      </div>`;
  }

  if (!isNew) {
    html += `<div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>Заказы запчасти</strong>
        <button class="btn small" id="newOrderBtn">+ Заказать</button>
      </div>
      <div id="ordersList" style="margin-top:8px"></div>
    </div>`;
  }

  html += `<div class="modal-actions">
    ${!isNew ? '<button class="btn danger" id="delBtn">Удалить</button>' : ''}
    <button class="btn secondary" id="cancelBtn">Отмена</button>
    <button class="btn" id="saveBtn">Сохранить</button></div>`;

  openModal(title, html, () => {
    $('#cancelBtn').onclick = () => closeModal();
    const changeBtn = $('#changeCatBtn');
    if (changeBtn) changeBtn.onclick = () => openCategoryPickerForPart(p.id);

    if (!isNew) {
      renderLinks(p.id);
      renderPartOrders(p.id);
      $('#addLinkBtn').onclick = async () => {
        const label = prompt('Название магазина (например, Ozon):');
        if (!label?.trim()) return;
        const url = prompt('Ссылка (URL):');
        if (!url?.trim()) return;
        let cleanUrl = url.trim();
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
        const { error } = await sb.from('part_links').insert({ part_id: p.id, label: label.trim(), url: cleanUrl });
        if (error) { alert('Ошибка: ' + error.message); return; }
        await loadAll(); renderLinks(p.id);
      };
      $('#newOrderBtn').onclick = () => openOrderForm(p);
    }

    $('#saveBtn').onclick = async () => {
      const obj = {
        name: $('#p_name').value.trim(),
        in_stock: Math.max(0, parseInt($('#p_stock').value) || 0),
        price_unit: Math.max(0, parseInt($('#p_price').value) || 0),
        ordered: Math.max(0, parseInt($('#p_ordered').value) || 0),
        notes: $('#p_notes').value.trim()
      };
      if (isNew) obj.category_ids = presetCat ? [presetCat] : [];
      if (!obj.name) { alert('Введи название'); return; }
      if (isNew) {
        const { data, error } = await sb.from('parts').insert(obj).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('add_part', `Добавил запчасть «${obj.name}» на склад (${obj.in_stock} шт)`, 'part', data.id);
        await loadAll(); closeModal(); openPartModal(data.id); render();
      } else {
        const { error } = await sb.from('parts').update(obj).eq('id', p.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('edit_part', `Изменил запчасть «${obj.name}»`, 'part', p.id);
        await loadAll(); render(); closeModal();
      }
    };

    if (!isNew) {
      $('#delBtn').onclick = async () => {
        const inRepairs = state.repairParts.filter(rp => rp.part_id === p.id);
        if (inRepairs.length) { alert(`Нельзя удалить: запчасть используется в ${inRepairs.length} записи ремонтов.`); return; }
        if (!confirm('Удалить запчасть со склада?')) return;
        const { error } = await sb.from('parts').delete().eq('id', p.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('del_part', `Удалил запчасть «${p.name}» со склада`, 'part', p.id);
        await loadAll(); render(); closeModal();
      };
    }
  });
}

function openCategoryPickerForPart(partId) {
  const part = state.parts.find(p => p.id === partId);
  if (!part) return;
  const current = part.category_ids || [];
  let html = `<div class="cat-list" id="catPickList">
    ${state.categories.map(c => `<label class="cat-item" style="cursor:pointer"><span class="cat-label"><input type="checkbox" value="${c.id}" ${current.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></span></label>`).join('') || '<div style="color:#999;padding:6px">Категорий пока нет</div>'}
  </div>
  <div class="sub" style="color:#888;font-size:12px;margin-top:6px">Если ничего не отметить — запчасть станет универсальной</div>
  <div class="modal-actions">
    <button class="btn secondary" id="ccCancel">Отмена</button>
    <button class="btn" id="ccSave">Сохранить</button>
  </div>`;
  openModal('Категории запчасти', html, () => {
    $('#ccCancel').onclick = () => closeModal(true);
    $('#ccSave').onclick = async () => {
      const checked = [...$('#catPickList').querySelectorAll('input:checked')].map(x => x.value);
      const { error } = await sb.from('parts').update({ category_ids: checked }).eq('id', partId);
      if (error) { alert('Ошибка: ' + error.message); return; }
      await addLog('edit_part_cats', `Изменил категории запчасти «${part.name}»`, 'part', partId);
      await loadAll(); closeModal(true); closeModal(); openPartModal(partId); render();
    };
  }, true);
}

function renderLinks(partId) {
  const box = $('#linksBox');
  if (!box) return;
  const list = state.links.filter(l => l.part_id === partId);
  if (!list.length) { box.innerHTML = `<div class="sub" style="color:#999">Пока нет ссылок</div>`; return; }
  box.innerHTML = list.map(l => `<div class="link-item">
    <a href="${esc(l.url)}" target="_blank" rel="noopener"><span>${esc(l.label)}</span><span>↗</span></a>
    <button class="btn small danger" data-del-link="${l.id}">×</button></div>`).join('');
  box.querySelectorAll('[data-del-link]').forEach(b => b.onclick = async () => {
    if (!confirm('Удалить ссылку?')) return;
    await sb.from('part_links').delete().eq('id', b.dataset.delLink);
    await loadAll(); renderLinks(partId);
  });
}

function renderPartOrders(partId) {
  const box = $('#ordersList');
  if (!box) return;
  const list = state.orders.filter(o => o.part_id === partId);
  if (!list.length) { box.innerHTML = `<div class="sub" style="color:#999">Пока нет заказов</div>`; return; }
  box.innerHTML = list.map(o => `<div class="inst-item">
    <div class="info">
      <strong>${o.qty} шт</strong> × ${money(o.price)} = ${money(o.total)}
      <div class="sub" style="font-size:12px;color:#888">${esc(o.shop_label || '—')} · ${fmtDate(o.ordered_at)} · ${esc(o.employee_name || '')}${o.status === 'bought' ? `<br>🟢 Куплено: ${fmtDate(o.bought_at)}` : '<br>🟡 Заказано'}</div>
    </div>
  </div>`).join('');
}

// ============ ЗАКАЗ ИЗ КАРТОЧКИ ЗАПЧАСТИ ============
function openOrderForm(p) {
  const links = state.links.filter(l => l.part_id === p.id);
  const linkOpts = links.map(l => `<option value="${esc(l.label)}||${esc(l.url)}">${esc(l.label)}</option>`).join('');
  const defaultPrice = p.price_unit || 0;

  let html = `
    <label>Магазин</label>
    ${links.length ? `<select id="o_shop">${linkOpts}<option value="__manual__">— Вписать вручную —</option></select>` : '<div class="sub" style="color:#999">Ссылок нет — впиши магазин вручную</div>'}
    <div id="manualShop" style="${links.length ? 'display:none' : ''}"><input id="o_shop_manual" placeholder="Название магазина" style="margin-top:6px"></div>
    <label>Количество</label>
    <div class="qty-row"><button class="btn secondary" id="oMinus">−</button><input id="o_qty" type="number" value="1" min="1"><button class="btn secondary" id="oPlus">+</button></div>
    <label>Цена за штуку, ₽</label><input id="o_price" type="number" min="0" value="${defaultPrice}">
    <label>Заметки</label><textarea id="o_notes"></textarea>
    <div class="modal-actions"><button class="btn secondary" id="oCancel">Отмена</button><button class="btn" id="oConfirm">Заказать</button></div>`;

  openModal('Заказать: ' + p.name, html, () => {
    $('#oMinus').onclick = () => { const i = $('#o_qty'); i.value = Math.max(1, (+i.value || 1) - 1); };
    $('#oPlus').onclick  = () => { const i = $('#o_qty'); i.value = (+i.value || 1) + 1; };
    if (links.length) $('#o_shop').onchange = e => { $('#manualShop').style.display = e.target.value === '__manual__' ? 'block' : 'none'; };
    $('#oCancel').onclick = () => closeModal(true);
    $('#oConfirm').onclick = async () => {
      let shopLabel = '', shopUrl = '';
      if (links.length) {
        const v = $('#o_shop').value;
        if (v === '__manual__') shopLabel = $('#o_shop_manual').value.trim();
        else { const [lbl, url] = v.split('||'); shopLabel = lbl; shopUrl = url; }
      } else shopLabel = $('#o_shop_manual').value.trim();
      const qty = Math.max(1, parseInt($('#o_qty').value) || 1);
      const price = Math.max(0, parseInt($('#o_price').value) || 0);
      await sb.from('orders').insert({
        part_id: p.id, part_name: p.name, shop_label: shopLabel, shop_url: shopUrl,
        qty, price, total: qty * price, status: 'ordered',
        employee_id: state.emp.id, employee_name: state.emp.name,
        notes: $('#o_notes').value.trim()
      });
      await sb.from('parts').update({ ordered: (p.ordered || 0) + qty }).eq('id', p.id);
      await addLog('order', `Заказал «${p.name}» (${qty} шт × ${money(price)})${shopLabel ? ', ' + shopLabel : ''}`, 'part', p.id);
      await loadAll(); closeModal(true); closeModal(); openPartModal(p.id); render();
    };
  }, true);
}

// ============ ЗАБРАЛ ============
export function openPickupDialog(partId) {
  const p = state.parts.find(x => x.id === partId);
  if (!p) return;
  const activeOrders = state.orders.filter(o => o.part_id === p.id && o.status === 'ordered');

  let html = `<label>Сколько пришло?</label>
    <div class="qty-row"><button class="btn secondary" id="pkMinus">−</button><input id="pk_qty" type="number" value="${p.ordered}" min="1" max="${p.ordered}"><button class="btn secondary" id="pkPlus">+</button></div>
    <div class="sub" style="color:#888;font-size:12px;margin-top:6px">Заказано: ${p.ordered} шт</div>
    <label>Цена за штуку, ₽</label><input id="pk_price" type="number" min="0" value="${p.price_unit || 0}">
    <label>Заметки</label><textarea id="pk_notes"></textarea>
    <div class="modal-actions"><button class="btn secondary" id="pkCancel">Отмена</button><button class="btn success" id="pkConfirm">Забрал</button></div>`;

  openModal('Забрал: ' + p.name, html, () => {
    $('#pkMinus').onclick = () => { const i = $('#pk_qty'); i.value = Math.max(1, (+i.value || 1) - 1); };
    $('#pkPlus').onclick  = () => { const i = $('#pk_qty'); i.value = Math.min(p.ordered, (+i.value || 1) + 1); };
    $('#pkCancel').onclick = () => closeModal();
    $('#pkConfirm').onclick = async () => {
      const qty = Math.max(1, Math.min(p.ordered, parseInt($('#pk_qty').value) || 1));
      const price = Math.max(0, parseInt($('#pk_price').value) || 0);
      const notes = $('#pk_notes').value.trim();
      const nowIso = new Date().toISOString();

      let remaining = qty;
      const sortedOrders = activeOrders.slice().sort((a, b) => new Date(a.ordered_at) - new Date(b.ordered_at));
      for (const o of sortedOrders) {
        if (remaining <= 0) break;
        if (o.qty <= remaining) {
          await sb.from('orders').update({ status: 'bought', bought_at: nowIso, price, total: o.qty * price, notes: notes || o.notes }).eq('id', o.id);
          remaining -= o.qty;
        } else {
          await sb.from('orders').update({ status: 'bought', bought_at: nowIso, price, total: remaining * price, notes: notes || o.notes, qty: remaining }).eq('id', o.id);
          await sb.from('orders').insert({
            part_id: p.id, part_name: p.name,
            shop_label: o.shop_label, shop_url: o.shop_url,
            qty: o.qty - remaining, price: o.price, total: (o.qty - remaining) * o.price,
            status: 'ordered',
            employee_id: state.emp.id, employee_name: state.emp.name
          });
          remaining = 0;
        }
      }
      await sb.from('parts').update({
        in_stock: (p.in_stock || 0) + qty,
        ordered: Math.max(0, (p.ordered || 0) - qty)
      }).eq('id', p.id);
      await addLog('pickup', `Забрал «${p.name}» — ${qty} шт, ${money(qty * price)}`, 'part', p.id);
      await loadAll(); render();
      closeModal();
    };
  });
}

// ============ ИНСТРУМЕНТЫ ============
export function addTool() { openToolForm(null); }

export function openToolForm(t) {
  const isNew = !t;
  const title = isNew ? 'Новый инструмент' : 'Инструмент: ' + t.name;
  const today = new Date().toISOString().slice(0, 10);

  let html = `
    <label>Название</label>
    <input id="t_name" value="${esc(t?.name || '')}" placeholder="Например: Дрель Makita">
    <label>Дата покупки</label>
    <input id="t_date" type="date" value="${t?.purchase_date || today}">
    <label>Цена, ₽</label>
    <input id="t_price" type="number" min="0" value="${t?.price ?? 0}">
    <label>Магазин</label>
    <input id="t_shop" value="${esc(t?.shop || '')}" placeholder="Например: Ozon">
    <label>Ссылка на товар</label>
    <input id="t_url" value="${esc(t?.url || '')}" placeholder="https://...">
    <label>Заметки</label>
    <textarea id="t_notes">${esc(t?.notes || '')}</textarea>
  `;

  html += `<div class="modal-actions">
    ${!isNew ? '<button class="btn danger" id="delBtn">Удалить</button>' : ''}
    <button class="btn secondary" id="cancelBtn">Отмена</button>
    <button class="btn" id="saveBtn">Сохранить</button></div>`;

  openModal(title, html, () => {
    $('#cancelBtn').onclick = () => closeModal();
    $('#saveBtn').onclick = async () => {
      const name = $('#t_name').value.trim();
      if (!name) { alert('Введи название'); return; }
      const obj = {
        name,
        purchase_date: $('#t_date').value || today,
        price: Math.max(0, parseInt($('#t_price').value) || 0),
        shop: $('#t_shop').value.trim(),
        url: $('#t_url').value.trim(),
        notes: $('#t_notes').value.trim()
      };
      if (isNew) {
        obj.employee_id = state.emp.id;
        obj.employee_name = state.emp.name;
        const { data, error } = await sb.from('tools').insert(obj).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('add_tool', `Добавил инструмент: ${name}`, 'tool', data.id);
      } else {
        const { error } = await sb.from('tools').update(obj).eq('id', t.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('edit_tool', `Изменил инструмент: ${name}`, 'tool', t.id);
      }
      await loadAll(); render(); closeModal();
    };
    if (!isNew) {
      $('#delBtn').onclick = async () => {
        if (!confirm(`Удалить инструмент «${t.name}»?`)) return;
        const { error } = await sb.from('tools').delete().eq('id', t.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        await addLog('del_tool', `Удалил инструмент: ${t.name}`, 'tool', t.id);
        await loadAll(); render(); closeModal();
      };
    }
  });
}
