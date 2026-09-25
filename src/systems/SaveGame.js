// Three save slots in localStorage. Storage can be unavailable (private windows, blocked storage),
// so every access is guarded.
export const SLOTS = [1, 2, 3];
const key = (slot) => `fieldborn-slot-${slot}`;
const LEGACY_KEY = 'fieldborn-save-v1'; // the single save from before slots existed

function read(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Move an old single-slot save into slot 1 (once), so nobody loses progress.
(function migrate() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && !localStorage.getItem(key(1))) localStorage.setItem(key(1), legacy);
    if (legacy) localStorage.removeItem(LEGACY_KEY);
  } catch { /* storage unavailable */ }
})();

export function saveGame(slot, data) {
  try {
    localStorage.setItem(key(slot), JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot) {
  return read(key(slot));
}

export function listSaves() {
  return SLOTS.map((slot) => ({ slot, data: loadGame(slot) }));
}

export function deleteSave(slot) {
  try {
    localStorage.removeItem(key(slot));
  } catch { /* storage unavailable */ }
}
