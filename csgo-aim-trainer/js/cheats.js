// cheats.js — cheat + settings state, persistence, and control metadata.
// It's a single-player aim trainer, so "cheats" are just fun sandbox toggles.

export const cheats = {
  aimbot: false,
  aimbotHead: true,
  aimbotFov: 8,        // degrees — cone around the crosshair the aimbot locks within
  aimbotSmooth: 0.25,  // 0.05 = buttery/slow, 1 = fast (never an instant snap)
  triggerbot: false,
  wallhack: false,     // ESP boxes + snaplines + see-through chams
  wallbang: false,     // bullets penetrate walls
  radar: false,        // minimap blips
  noRecoil: false,
  noSpread: false,     // pinpoint "laser" accuracy
  infiniteAmmo: false, // mag never depletes
  rapidFire: false,    // fire-rate multiplier
  godMode: false,
  oneHitKill: false,
  superSpeed: false,
  superJump: false,
};

export const settings = {
  sensitivity: 1.0,    // mouse look multiplier (great for trackpads)
  musicVolume: 0.6,
  sfxVolume: 0.9,
  soundtrack: 0,
  variation: 1,
};

// Control metadata drives the auto-generated CHEATS panel. `hotkey` (if set)
// is a single KeyboardEvent.code letter that toggles the cheat in-game.
export const CHEAT_CONTROLS = [
  { k: 'aimbot',       label: 'Aimbot',            type: 'toggle', hotkey: 'KeyB', desc: 'Auto-lock onto the nearest enemy' },
  { k: 'aimbotHead',   label: '› Target head',     type: 'toggle', sub: true },
  { k: 'aimbotFov',    label: '› Lock-on FOV',     type: 'range', min: 1, max: 60, step: 1, unit: '°', sub: true },
  { k: 'aimbotSmooth', label: '› Smoothing',       type: 'range', min: 0.05, max: 1, step: 0.05, sub: true },
  { k: 'triggerbot',   label: 'Triggerbot',        type: 'toggle', hotkey: 'KeyX', desc: 'Auto-fire when aimed at an enemy' },
  { k: 'wallhack',     label: 'Wallhack / ESP',    type: 'toggle', hotkey: 'KeyV', desc: 'See enemies through walls + boxes' },
  { k: 'wallbang',     label: 'Wallbang',          type: 'toggle', hotkey: 'KeyN', desc: 'Bullets shoot through walls' },
  { k: 'radar',        label: 'Radar',             type: 'toggle', desc: 'Top-down minimap of enemies' },
  { k: 'noRecoil',     label: 'No recoil',         type: 'toggle' },
  { k: 'noSpread',     label: 'No spread (laser)', type: 'toggle' },
  { k: 'infiniteAmmo', label: 'Infinite ammo',     type: 'toggle' },
  { k: 'rapidFire',    label: 'Rapid fire',        type: 'toggle' },
  { k: 'godMode',      label: 'God mode',          type: 'toggle', hotkey: 'KeyG' },
  { k: 'oneHitKill',   label: 'One-hit kill',      type: 'toggle' },
  { k: 'superSpeed',   label: 'Super speed',       type: 'toggle' },
  { k: 'superJump',    label: 'Super jump',        type: 'toggle' },
];

const CH_KEY = 'duststrike_cheats';
const ST_KEY = 'duststrike_settings2';

export function loadCheatState() {
  try {
    const c = JSON.parse(localStorage.getItem(CH_KEY) || '{}');
    for (const k in c) if (k in cheats) cheats[k] = c[k];
    const s = JSON.parse(localStorage.getItem(ST_KEY) || '{}');
    for (const k in s) if (k in settings) settings[k] = s[k];
  } catch (_) {}
}
export function saveCheatState() {
  try {
    localStorage.setItem(CH_KEY, JSON.stringify(cheats));
    localStorage.setItem(ST_KEY, JSON.stringify(settings));
  } catch (_) {}
}

export function anyCheatOn() {
  return CHEAT_CONTROLS.some(c => c.type === 'toggle' && cheats[c.k]);
}
