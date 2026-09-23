// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

// Экранирование HTML (защита от XSS и сломанной разметки)
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Дата+время: "13.09.2026, 14:30"
export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Только дата: "13.09.2026"
export function fmtDay(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

// Деньги: "7 593 ₽"
export function money(n) {
  return (Math.round(n || 0)).toLocaleString('ru-RU') + ' ₽';
}

// SHA-256 хеш (для пароля)
export async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Короткие селекторы
export const $  = sel => document.querySelector(sel);
export const $$ = sel => document.querySelectorAll(sel);
