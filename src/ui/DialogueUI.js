const $ = (s) => document.querySelector(s);

// Renders a dialogue tree (see data/dialogue.js) with a typewriter effect and numbered choices.
export class DialogueUI {
  constructor() {
    this.el = $('#dialogue');
    this.speakerEl = this.el.querySelector('.dlg-speaker');
    this.textEl = this.el.querySelector('.dlg-text');
    this.optsEl = this.el.querySelector('.dlg-options');
    this.active = false;
    this.optsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (btn) this.choose(Number(btn.dataset.i));
    });
    this.textEl.addEventListener('click', () => this.finishTyping());
  }

  open(speaker, tree, start, onClose) {
    this.speaker = speaker;
    this.tree = tree;
    this.onClose = onClose;
    this.active = true;
    this.el.classList.remove('hidden');
    this.goto(start);
  }

  close() {
    this.active = false;
    this.el.classList.add('hidden');
    this.onClose?.();
  }

  goto(id) {
    if (id == null) return this.close();
    const node = this.tree[id];
    // Text reads the state as it was on arrival; options see the effects of onEnter.
    this.fullText = typeof node.text === 'function' ? node.text() : node.text;
    node.onEnter?.();
    const opts = typeof node.options === 'function' ? node.options() : node.options || [];
    this.options = opts.filter((o) => !o.if || o.if());
    this.speakerEl.textContent = typeof this.speaker === 'function' ? this.speaker() : this.speaker;
    this.chars = 0;
    this.textEl.textContent = '';
    this.optsEl.innerHTML = '';
    this.optsEl.classList.add('hidden');
  }

  finishTyping() {
    if (this.chars >= this.fullText.length) return;
    this.chars = this.fullText.length;
    this.textEl.textContent = this.fullText;
    this.showOptions();
  }

  showOptions() {
    this.optsEl.innerHTML = this.options
      .map((o, i) => `<button data-i="${i}"><span class="num">${i + 1}</span>${o.text}</button>`)
      .join('');
    this.optsEl.classList.remove('hidden');
  }

  choose(i) {
    const o = this.options[i];
    if (!o || this.chars < this.fullText.length) return;
    o.do?.();
    this.goto(o.next ?? null);
  }

  update(dt, input) {
    if (!this.active) return;
    if (this.chars < this.fullText.length) {
      this.chars = Math.min(this.fullText.length, this.chars + dt * 60);
      this.textEl.textContent = this.fullText.slice(0, Math.floor(this.chars));
      if (this.chars >= this.fullText.length) this.showOptions();
      if (input.wasPressed('Space', 'Enter', 'KeyE')) this.finishTyping();
      return;
    }
    for (let i = 0; i < 9; i++) if (input.wasPressed(`Digit${i + 1}`)) return this.choose(i);
    if (input.wasPressed('Escape')) {
      // Esc means "goodbye": the last option that simply ends the conversation (not one that opens a shop).
      let bye = -1;
      this.options.forEach((o, i) => { if (o.next === null && !o.do) bye = i; });
      if (bye >= 0) this.choose(bye);
    }
  }
}
