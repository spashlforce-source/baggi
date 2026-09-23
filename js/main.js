// ============================================================
// ТОЧКА ВХОДА: собирает всё вместе, вешает события
// ============================================================

import { sb } from './config.js';
import { state, loadAll } from './state.js';
import { render } from './render.js';
import { tryLogin, logout, autoLogin, startApp } from './auth.js';
import { addTech, addPart, addTool, openCategoryForm } from './modals.js';
import { $, $$ } from './utils.js';

// ---------- ВХОД/ВЫХОД ----------
$('#loginBtn').onclick = tryLogin;
$('#passwordInput').onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
$('#loginInput').onkeydown   = e => { if (e.key === 'Enter') $('#passwordInput').focus(); };

$('#logoutBtn').onclick = () => {
  if (confirm('Выйти?')) logout();
};

// ---------- НАВИГАЦИЯ (нижние вкладки) ----------
$$('nav button').forEach(b => b.onclick = () => {
  state.view = b.dataset.view;
  state.search = '';
  state.garageCat = null;
  state.whCat = null;
  state.historyOpen = false;
  render();
});

// ---------- КНОПКА "НАЗАД" ----------
$('#backBtn').onclick = () => {
  if (state.view === 'garage') state.garageCat = null;
  if (state.view === 'warehouse') state.whCat = null;
  state.search = '';
  state.historyOpen = false;
  render();
};

// ---------- КНОПКА "+" (FAB) ----------
$('#addBtn').onclick = () => {
  if (state.view === 'garage') {
    if (!state.garageCat) openCategoryForm(null);   // создать категорию
    else addTech();                                 // создать технику
  }
  else if (state.view === 'warehouse') {
    if (state.whTab === 'parts' && state.whCat) addPart();   // создать запчасть
    else if (state.whTab === 'tools') addTool();             // создать инструмент
  }
};

// ---------- АВТОЗАПУСК ----------
(async function init() {
  const logged = await autoLogin();
  if (!logged) {
    $('#loadingScreen').style.display = 'none';
    $('#loginScreen').style.display = 'flex';
  }
})();
