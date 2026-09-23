// ============================================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ + ЗАГРУЗКА ДАННЫХ
// ============================================================

import { sb } from './config.js';

export const state = {
  view: 'garage',           // текущая вкладка: garage | warehouse | logs
  garageCat: null,          // категория внутри гаража (null = список категорий)
  whCat: null,              // категория внутри склада (null = список категорий)
  whTab: 'parts',           // подвкладка склада: parts | orders | tools
  historyOpen: false,       // развёрнута ли "История заказов"
  emp: null,                // текущий сотрудник
  techs: [],                // техника
  parts: [],                // запчасти
  categories: [],           // категории (общие для техники и запчастей)
  links: [],                // ссылки запчастей на магазины
  repairs: [],              // ремонты
  repairParts: [],          // запчасти внутри ремонтов
  orders: [],               // заказы запчастей
  tools: [],                // инструменты
  logs: [],                 // логи
  search: '',               // поиск (в текущем экране)
  orderFilter: 'all'        // фильтр заказов: all | month | year
};

// Загрузка ВСЕХ данных из Supabase одним махом
export async function loadAll() {
  const [techs, parts, cats, links, repairs, repairParts, orders, tools, logs] = await Promise.all([
    sb.from('techs').select('*').order('name'),
    sb.from('parts').select('*').order('name'),
    sb.from('categories').select('*').order('name'),
    sb.from('part_links').select('*'),
    sb.from('repairs').select('*').order('created_at', { ascending: false }),
    sb.from('repair_parts').select('*'),
    sb.from('orders').select('*').order('ordered_at', { ascending: false }),
    sb.from('tools').select('*').order('purchase_date', { ascending: false }),
    sb.from('logs').select('*').order('created_at', { ascending: false }).limit(300)
  ]);

  state.techs = techs.data || [];
  state.parts = parts.data || [];
  state.categories = cats.data || [];
  state.links = links.data || [];
  state.repairs = repairs.data || [];
  state.repairParts = repairParts.data || [];
  state.orders = orders.data || [];
  state.tools = tools.data || [];
  state.logs = logs.data || [];
}

// Проверка: есть ли у техники активный ремонт?
export function techHasActiveRepair(techId) {
  return state.repairs.some(r => r.tech_id === techId && r.status === 'in_progress');
}

// Статус техники: 'repair' (есть активный ремонт) или 'free'
export function techStatus(tech) {
  return techHasActiveRepair(tech.id) ? 'repair' : 'free';
}

// Записать действие в лог
export async function addLog(action, description, entity_type = null, entity_id = null) {
  if (!state.emp) return;
  await sb.from('logs').insert({
    employee_id: state.emp.id,
    employee_name: state.emp.name,
    action, description, entity_type, entity_id
  });
}
