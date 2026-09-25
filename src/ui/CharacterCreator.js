import { DEFAULT_APPEARANCE } from '../entities/Player.js';
import { HAIR_STYLES } from '../entities/Humanoid.js';

const $ = (s) => document.querySelector(s);
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

const SKINS = [0xf2d3b3, 0xe0b18c, 0xc98f6a, 0xa8704a, 0x8a5a3a, 0x5e3a24];
const HAIR_COLOURS = [0x1a1410, 0x2b1d14, 0x6b4a2a, 0xa8743a, 0xd9b36a, 0x9a3b1c, 0xcfcfcf, 0x3a4a6a];
const OUTFITS = [0x8a7a62, 0x566070, 0x6b3f3a, 0x3f5a3a, 0x4a3f6b, 0x7a6a3a];
const STYLE_NAMES = { short: 'Short', long: 'Long', ponytail: 'Ponytail', curly: 'Curly', shaved: 'Shaved' };
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
      this.app[opt] = opt === 'gender' || opt === 'hairStyle' ? val : opt === 'beard' ? val === 'true' : Number(val);
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
      gender: any(['male', 'female']), skin: any(SKINS), hair: any(HAIR_COLOURS),
      hairStyle: any(HAIR_STYLES), shirt: any(OUTFITS), beard: Math.random() < 0.25,
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
    $('#creator-skin').innerHTML = SKINS.map((c) => swatch('skin', c)).join('');
    $('#creator-style').innerHTML = HAIR_STYLES.map((s) => choice('hairStyle', s, STYLE_NAMES[s], a.hairStyle === s)).join('');
    $('#creator-hair').innerHTML = HAIR_COLOURS.map((c) => swatch('hair', c)).join('');
    $('#creator-outfit').innerHTML = OUTFITS.map((c) => swatch('shirt', c)).join('');
    $('#creator-beard').innerHTML = [choice('beard', 'false', 'None', !a.beard), choice('beard', 'true', 'Beard', a.beard)].join('');
  }
}
