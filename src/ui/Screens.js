import { ITEMS } from '../data/items.js';
import { SHARD_MEMORIES, LETTER } from '../data/story.js';

const $ = (s) => document.querySelector(s);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

// Full-screen overlays: title, intro narration, story cards, inventory, journal, pause and death.
export class Screens {
  constructor(game) {
    this.g = game;
    this.title = $('#title');
    this.intro = $('#intro');
    this.card = $('#card');
    this.inventory = $('#inventory');
    this.journal = $('#journal');
    this.pause = $('#pause');
    this.death = $('#death');
    this.fadeEl = $('#fade');
    this.cards = [];
    this.selected = null;

    $('#btn-new').addEventListener('click', () => game.newGame());
    $('#btn-continue').addEventListener('click', () => game.continueGame());
    $('#btn-resume').addEventListener('click', () => game.resume());
    $('#btn-save').addEventListener('click', () => game.save(true));
    $('#btn-respawn').addEventListener('click', () => game.respawn());
    this.card.addEventListener('click', () => this.closeCard());
    this.intro.addEventListener('click', () => (this.introClick = true));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeMenu()));

    this.inventory.addEventListener('click', (e) => {
      const slot = e.target.closest('[data-item]');
      if (slot) {
        this.selected = slot.dataset.item;
        this.renderInventory();
      }
      const action = e.target.closest('[data-action]');
      if (action) {
        game.useItem(action.dataset.id);
        this.renderInventory();
      }
    });
  }

  // ---- Title / intro ----
  showTitle(hasSave) {
    show(this.title);
    $('#btn-continue').classList.toggle('hidden', !hasSave);
  }

  hideTitle() {
    hide(this.title);
  }

  showIntro(lines, onDone) {
    show(this.intro);
    $('#intro-lines').innerHTML = '';
    hide($('#intro-prompt'));
    Object.assign(this, { introT: 0, introLines: lines, introShown: 0, introDone: onDone, introClick: false });
  }

  updateIntro(dt, input) {
    const step = 1.7, lines = this.introLines;
    this.introT += dt;
    const target = Math.min(lines.length, Math.floor(this.introT / step) + 1);
    while (this.introShown < target) {
      const p = document.createElement('p');
      p.textContent = lines[this.introShown++];
      $('#intro-lines').appendChild(p);
    }
    const ready = this.introT > lines.length * step + 0.4;
    if (ready) show($('#intro-prompt'));
    if (input.anyPressed() || this.introClick) {
      this.introClick = false;
      if (!ready) this.introT = lines.length * step + 0.4; // skip ahead
      else {
        hide(this.intro);
        this.introDone();
      }
    }
  }

  // ---- Story cards (queued) ----
  showCard(card) {
    this.cards.push(card);
    if (!this.cardOpen) this.nextCard();
  }

  nextCard() {
    const c = this.cards.shift();
    if (!c) {
      this.cardOpen = false;
      hide(this.card);
      this.g.onCardsClosed();
      return;
    }
    this.cardOpen = true;
    this.cardOpenedAt = performance.now();
    this.card.querySelector('.card').className = `card ${c.style || ''}`;
    this.card.querySelector('.card-kind').textContent = c.kind || '';
    this.card.querySelector('.card-title').textContent = c.title;
    this.card.querySelector('.card-body').innerHTML = c.body;
    show(this.card);
  }

  closeCard() {
    if (!this.cardOpen || performance.now() - this.cardOpenedAt < 450) return;
    this.nextCard();
  }

  // ---- Menus ----
  openMenu(name) {
    this.menu = name;
    if (name === 'inventory') {
      this.renderInventory();
      show(this.inventory);
    } else if (name === 'journal') {
      this.renderJournal();
      show(this.journal);
    }
  }

  closeMenu() {
    hide(this.inventory);
    hide(this.journal);
    this.menu = null;
    this.g.setMode('play');
  }

  handleMenuInput(input) {
    if (input.wasPressed('Escape') ||
      (this.menu === 'inventory' && input.wasPressed('KeyI', 'Tab')) ||
      (this.menu === 'journal' && input.wasPressed('KeyJ'))) {
      this.closeMenu();
    }
  }

  renderInventory() {
    const g = this.g, inv = g.inventory, p = g.player;
    const entries = inv.entries();
    if (!this.selected || !inv.has(this.selected)) this.selected = entries[0]?.[0] ?? null;
    const equipped = new Set(Object.values(p.equipment));

    this.inventory.querySelector('.inv-grid').innerHTML = entries.length
      ? entries.map(([id, n]) => {
        const it = ITEMS[id];
        return `<button class="slot ${id === this.selected ? 'sel' : ''}" data-item="${id}" title="${it.name}">
          <span class="icon">${it.icon}</span>${n > 1 ? `<span class="count">${n}</span>` : ''}
          ${equipped.has(id) ? '<span class="eq">E</span>' : ''}</button>`;
      }).join('')
      : '<p class="empty">Your pockets are empty. You have no idea what you used to carry.</p>';

    const it = ITEMS[this.selected];
    let action = '';
    if (it?.type === 'consumable') action = 'Use';
    if ((it?.type === 'weapon' || it?.type === 'armor') && !equipped.has(this.selected)) action = 'Equip';
    if (this.selected === 'torn_letter') action = 'Read';
    const stat = it?.damage ? `<p class="stat">+${it.damage} attack</p>` : it?.defense ? `<p class="stat">+${it.defense} defense</p>` : it?.heal ? `<p class="stat">Restores ${it.heal} HP</p>` : '';
    this.inventory.querySelector('.inv-detail').innerHTML = it
      ? `<h3>${it.icon} ${it.name}</h3><p class="type">${it.type}</p><p>${it.desc}</p>${stat}
         ${action ? `<button class="primary" data-action data-id="${this.selected}">${action}</button>` : ''}`
      : '';

    const s = p.stats;
    this.inventory.querySelector('.char-sheet').innerHTML = `
      <h3>${g.playerName}</h3>
      <dl>
        <dt>Level</dt><dd>${s.level}</dd>
        <dt>Health</dt><dd>${Math.ceil(s.hp)} / ${s.maxHp}</dd>
        <dt>Attack</dt><dd>${p.attackPower}</dd>
        <dt>Defense</dt><dd>${p.defense}</dd>
        <dt>Experience</dt><dd>${s.xp} / ${p.xpToNext}</dd>
        <dt>Weapon</dt><dd>${ITEMS[p.equipment.weapon]?.name ?? 'Bare hands'}</dd>
        <dt>Armor</dt><dd>${ITEMS[p.equipment.armor]?.name ?? 'Ragged tunic'}</dd>
      </dl>`;
  }

  renderJournal() {
    const g = this.g;
    const active = g.quests.list();
    const done = g.quests.list((st) => st.status === 'done');
    const memories = g.memories.map((i) => SHARD_MEMORIES[i]);
    const questHtml = (q) => `
      <div class="jq ${q.status}">
        <h4>${q.title}${q.status === 'ready' ? ` <em>· return to ${q.turnInName}</em>` : ''}</h4>
        <p>${q.summary}</p>
        <ul>${q.objectives.map((o) => `<li class="${o.have >= o.need ? 'done' : ''}">${o.text}${o.need > 1 ? ` (${o.have}/${o.need})` : ''}</li>`).join('')}</ul>
      </div>`;
    this.journal.querySelector('.journal-body').innerHTML = `
      <section><h3>Quests</h3>${active.length ? active.map(questHtml).join('') : '<p class="empty">Nothing to do but wander.</p>'}</section>
      <section><h3>Memories</h3>
        ${g.inventory.has('torn_letter') ? `<details><summary>${LETTER.title}</summary>${LETTER.body}</details>` : ''}
        ${memories.length ? memories.map((m) => `<details><summary>${m.title}</summary>${m.body}</details>`).join('') : '<p class="empty">You remember nothing. Not yet.</p>'}
      </section>
      ${done.length ? `<section><h3>Completed</h3><ul class="done-list">${done.map((q) => `<li>${q.title}</li>`).join('')}</ul></section>` : ''}`;
  }

  // ---- Pause / death ----
  showPause() { show(this.pause); }
  hidePause() { hide(this.pause); }
  showDeath() { show(this.death); }
  hideDeath() { hide(this.death); }

  // Fade to black, run the callback while hidden, then fade back.
  fadeThrough(cb) {
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      cb();
      setTimeout(() => this.fadeEl.classList.remove('on'), 250);
    }, 650);
  }
}
