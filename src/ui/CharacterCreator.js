import { DEFAULT_APPEARANCE } from '../entities/Player.js';
import { HAIR_STYLES, HAIR_NAMES, OUTFITS, SKIN_TONES } from '../entities/CharacterModel.js';

const $ = (s) => document.querySelector(s);
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

const HAIR_COLOURS = [0x1a1410, 0x3a2a1a, 0x6b4a2a, 0xa8743a, 0xe0c080, 0x9a3b1c, 0xd8d8d8, 0x3a4a6a];
// Dyes are blended gently over the painted cloth, so white means "as painted".
const DYES = [0xffffff, 0x5a7ab0, 0xb04a3a, 0x4a8a4a, 0x7a5ab0, 0xc0a040];
const OUTFIT_NAMES = { peasant: 'Peasant', ranger: 'Ranger' };
const DEFAULT_NAME = 'Aren';

// Character creation: pick a name and a look. The player's model updates live as options change,
// with the camera turning slowly around them.
export class CharacterCreator {
  constructor(game) {
    this.g = game;
    this.el = $('#creator');
    this.nameInput = $('#creator-name');
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-opt]');
      if (!b) return;
      const { opt, val } = b.dataset;
      this.app[opt] = ['gender', 'hairStyle', 'outfit'].includes(opt) ? val : opt === 'beard' || opt === 'hood' ? val === 'true' : Number(val);
      this.apply();
    });
    $('#creator-begin').addEventListener('click', () => this.finish());
    $('#creator-back').addEventListener('click', () => {
      this.hide();
      this.onBack?.();
    });
    $('#creator-random').addEventListener('click', () => this.randomise());
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.finish();
    });
  }

  open(onDone, onBack) {
    this.onDone = onDone;
    this.onBack = onBack;
    this.app = { ...DEFAULT_APPEARANCE };
    this.nameInput.value = '';
    this.el.classList.remove('hidden');
    this.apply();
    setTimeout(() => this.nameInput.focus(), 50);
  }

  hide() {
    this.el.classList.add('hidden');
  }

  randomise() {
    const any = (arr) => arr[Math.floor(Math.random() * arr.length)];
    this.app = {
      ...this.app,
      gender: any(['male', 'female']), outfit: any(OUTFITS), skin: any(SKIN_TONES), hair: any(HAIR_COLOURS),
      hairStyle: any(HAIR_STYLES), dye: any(DYES), beard: Math.random() < 0.25,
    };
    this.apply();
  }

  apply() {
    this.g.player.setAppearance(this.app);
    this.render();
  }

  finish() {
    const name = this.nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 16) || DEFAULT_NAME;
    this.hide();
    this.onDone(name, { ...this.app });
  }

  render() {
    const a = this.app;
    const choice = (opt, val, label, active) =>
      `<button class="chip ${active ? 'on' : ''}" data-opt="${opt}" data-val="${val}">${label}</button>`;
    const swatch = (opt, val) =>
      `<button class="swatch ${a[opt] === val ? 'on' : ''}" data-opt="${opt}" data-val="${val}" style="background:${hex(val)}" aria-label="${opt} ${hex(val)}"></button>`;
    $('#creator-body').innerHTML = [
      choice('gender', 'male', 'Masculine', a.gender === 'male'),
      choice('gender', 'female', 'Feminine', a.gender === 'female'),
    ].join('');
    $('#creator-outfit').innerHTML = OUTFITS.map((o) => choice('outfit', o, OUTFIT_NAMES[o], a.outfit === o)).join('');
    $('#creator-skin').innerHTML = SKIN_TONES.map((c) => swatch('skin', c)).join('');
    $('#creator-style').innerHTML = HAIR_STYLES.map((st) => choice('hairStyle', st, HAIR_NAMES[st], a.hairStyle === st)).join('');
    $('#creator-hair').innerHTML = HAIR_COLOURS.map((c) => swatch('hair', c)).join('');
    $('#creator-dye').innerHTML = DYES.map((c) => swatch('dye', c)).join('');
    $('#creator-beard').innerHTML = [choice('beard', 'false', 'None', !a.beard), choice('beard', 'true', 'Beard', a.beard)].join('');
    // Only the ranger outfit has a hood.
    $('#creator-hood-row').classList.toggle('hidden', a.outfit !== 'ranger');
    $('#creator-hood').innerHTML = [choice('hood', 'false', 'Down', !a.hood), choice('hood', 'true', 'Up', a.hood)].join('');
  }
}
