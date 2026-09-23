// ============================================================
// АВТОРИЗАЦИЯ: вход, выход, старт приложения
// ============================================================

import { sb } from './config.js';
import { state, loadAll, addLog } from './state.js';
import { sha256, $ } from './utils.js';
import { render } from './render.js';

// Попытка входа по логину/паролю
export async function tryLogin() {
  const login = $('#loginInput').value.trim().toLowerCase();
  const pass  = $('#passwordInput').value;
  $('#loginErr').textContent = '';

  if (!login || !pass) {
    $('#loginErr').textContent = 'Введите логин и пароль';
    return;
  }

  const hash = await sha256(pass);

  const { data, error } = await sb
    .from('employees')
    .select('id, login, name, role, password_hash')
    .eq('login', login)
    .maybeSingle();

  if (error)  { $('#loginErr').textContent = 'Ошибка: ' + error.message; return; }
  if (!data)  { $('#loginErr').textContent = 'Пользователь не найден'; return; }
  if (data.password_hash !== hash) { $('#loginErr').textContent = 'Неверный пароль'; return; }

  const emp = { id: data.id, login: data.login, name: data.name, role: data.role };
  localStorage.setItem('rental_employee', JSON.stringify(emp));
  state.emp = emp;

  await startApp();
}

// Выход
export function logout() {
  localStorage.removeItem('rental_employee');
  state.emp = null;
  $('#app').style.display = 'none';
  $('#loginScreen').style.display = 'flex';
  $('#loginInput').value = '';
  $('#passwordInput').value = '';
}

// Запуск основного приложения после входа
export async function startApp() {
  $('#loadingScreen').style.display = 'none';
  $('#loginScreen').style.display = 'none';
  $('#app').style.display = 'block';

  await loadAll();
  render();
  subscribeRealtime();
}

// Realtime — синхронизация между устройствами
let rt = false;
export function subscribeRealtime() {
  if (rt) return;
  rt = true;

  const reload = async () => {
    await loadAll();
    render();
  };

  sb.channel('db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'techs' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'part_links' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_parts' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tools' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, reload)
    .subscribe();
}

// Автовход — если сотрудник уже был сохранён в localStorage
export async function autoLogin() {
  const saved = localStorage.getItem('rental_employee');
  if (saved) {
    try {
      state.emp = JSON.parse(saved);
      await startApp();
      return true;
    } catch (e) {
      localStorage.removeItem('rental_employee');
    }
  }
  return false;
}
