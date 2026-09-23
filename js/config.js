// ============================================================
// КОНФИГУРАЦИЯ SUPABASE + умная загрузка библиотеки с 4 CDN
// ============================================================

const SUPABASE_URL = 'https://mieypqtkrsbtujbtlgey.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gLuUMy49IZEgkFRjk6qMeQ_wt3cMJWG';

// Список CDN — пробуем по очереди, пока не сработает
const CDN_LIST = [
  { name: 'jsdelivr', url: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm' },
  { name: 'unpkg',    url: 'https://unpkg.com/@supabase/supabase-js@2/dist/main/esm/index.js' },
  { name: 'esm.sh',   url: 'https://esm.sh/@supabase/supabase-js@2' },
  { name: 'skypack',  url: 'https://cdn.skypack.dev/@supabase/supabase-js@2' }
];

async function loadSupabaseCreateClient() {
  const status = document.getElementById('loadStatus');
  for (const cdn of CDN_LIST) {
    try {
      if (status) status.textContent = 'Пробую ' + cdn.name + '...';
      const mod = await import(cdn.url);
      if (mod && mod.createClient) {
        console.log('✅ Supabase загружен с', cdn.name);
        if (status) status.textContent = 'OK: ' + cdn.name;
        return mod.createClient;
      }
    } catch (e) {
      console.warn('❌ CDN не сработал:', cdn.name, e.message);
    }
  }
  throw new Error('Не удалось загрузить Supabase ни с одного CDN');
}

let createClient;
try {
  createClient = await loadSupabaseCreateClient();
} catch (e) {
  document.getElementById('loadingScreen').innerHTML =
    '<div style="color:#dc2626;text-align:center;padding:20px;max-width:400px">' +
    '<strong>Не удалось загрузить приложение</strong><br><br>' +
    'Проблема с доступом к интернет-библиотеке.<br>' +
    'Попробуй:<br>1. Сменить DNS на 8.8.8.8<br>2. Другой браузер<br>3. Мобильный интернет' +
    '</div>';
  throw e;
}

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export { SUPABASE_URL, SUPABASE_KEY };
