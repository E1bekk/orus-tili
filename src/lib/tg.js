// Telegram Mini App: работает и внутри Telegram, и в обычном браузере (для проверки).
const W = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp;
export const tg = W && W.initData !== undefined ? W : null;
export const inTelegram = !!(tg && tg.initData);

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    // на телефоне — во весь экран, без шапки Telegram (как в Scroll)
    const phone = tg.platform === 'ios' || tg.platform === 'android';
    if (phone && tg.requestFullscreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && !tg.isFullscreen) tg.requestFullscreen();
    // тёмно-синяя тема всегда — шапка Telegram в тон приложению
    if (tg.setHeaderColor) tg.setHeaderColor('#070b1d');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#070b1d');
    if (tg.setBottomBarColor) tg.setBottomBarColor('#070b1d');
  } catch (e) {}
}

export const initData = () => (tg && tg.initData) || '';
export const userName = () => {
  const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  return u ? u.first_name || '' : '';
};

export function haptic(kind = 'light') {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (kind === 'ok') tg.HapticFeedback.notificationOccurred('success');
    else if (kind === 'bad') tg.HapticFeedback.notificationOccurred('error');
    else tg.HapticFeedback.impactOccurred(kind);
  } catch (e) {}
}

// кнопка «Назад» в шапке Telegram
export function backButton(on, cb) {
  if (!tg || !tg.BackButton) return () => {};
  try {
    if (on) { tg.BackButton.show(); tg.BackButton.onClick(cb); } else tg.BackButton.hide();
  } catch (e) {}
  return () => { try { tg.BackButton.offClick(cb); } catch (e) {} };
}

// Хранилище: облако Telegram (видно с любого телефона мамы), а вне Telegram — память браузера.
const cloud = () => tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;

export function load(key) {
  return new Promise(ok => {
    const c = cloud();
    if (c) {
      try { c.getItem(key, (err, v) => ok(err ? local(key) : (v || local(key)))); return; } catch (e) {}
    }
    ok(local(key));
  });
}

export function save(key, value) {
  const v = String(value);
  try { localStorage.setItem('ot_' + key, v); } catch (e) {}
  const c = cloud();
  if (c) { try { c.setItem(key, v.slice(0, 4000), () => {}); } catch (e) {} }
}

function local(key) {
  try { return localStorage.getItem('ot_' + key) || ''; } catch (e) { return ''; }
}

// Списки (выученные слова и т.п.) бывают длинными, а облако Telegram хранит
// не больше 4096 символов в одной ячейке. Поэтому режем список на части.
const CHUNK = 3800;

export function saveList(key, arr) {
  try { localStorage.setItem('ot_' + key, arr.join('|')); } catch (e) {}
  const c = cloud();
  if (!c) return;
  const parts = [];
  let cur = '';
  for (const item of arr) {
    const add = (cur ? '|' : '') + item;
    if (cur && (cur + add).length > CHUNK) { parts.push(cur); cur = item; } else cur += add;
  }
  parts.push(cur);
  try {
    parts.forEach((p, i) => c.setItem(`${key}_${i}`, p, () => {}));
    c.setItem(`${key}_n`, String(parts.length), () => {});
  } catch (e) {}
}

export function loadList(key) {
  const split = s => (s ? String(s).split('|').filter(Boolean) : []);
  const fromLocal = () => split(local(key));
  return new Promise(ok => {
    const c = cloud();
    if (!c) return ok(fromLocal());
    try {
      c.getItem(`${key}_n`, (err, n) => {
        const count = parseInt(n, 10);
        if (err || !count) {
          // старый формат — одной строкой
          c.getItem(key, (e2, v) => ok(e2 || !v ? fromLocal() : split(v)));
          return;
        }
        const keys = Array.from({ length: count }, (_, i) => `${key}_${i}`);
        c.getItems(keys, (e3, vals) => {
          if (e3 || !vals) return ok(fromLocal());
          ok(split(keys.map(k => vals[k] || '').filter(Boolean).join('|')));
        });
      });
    } catch (e) { ok(fromLocal()); }
  });
}
