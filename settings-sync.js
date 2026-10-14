// ==========================================
// Settings, Storage & Backup Engine
// ==========================================

export function saveLocalData(uid, key, data) {
  try {
    localStorage.setItem(`giti_${uid}_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Local storage save error:", e);
  }
}

export function getLocalData(uid, key, fallback = []) {
  try {
    const data = localStorage.getItem(`giti_${uid}_${key}`);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.warn("Local storage read error:", e);
    return fallback;
  }
}

export function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('app_theme', themeName);
}
