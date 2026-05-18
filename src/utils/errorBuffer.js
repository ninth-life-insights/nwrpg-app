const KEY = '__nwrpg_errors';
const MAX = 20;

export function logError(type, err, extra) {
  try {
    const buf = JSON.parse(localStorage.getItem(KEY) || '[]');
    buf.push({
      t: Date.now(),
      type,
      message: err?.message || String(err),
      stack: err?.stack || null,
      ...(extra || {}),
    });
    while (buf.length > MAX) buf.shift();
    localStorage.setItem(KEY, JSON.stringify(buf));
  } catch {}
}
