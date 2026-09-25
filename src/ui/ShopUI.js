import { ITEMS, sellPrice } from '../data/items.js';
import { SHOPS } from '../data/shops.js';

const $ = (s) => document.querySelector(s);

// Buy / sell window for a merchant. Stock is unlimited; one-of-a-kind items vanish once owned.
export class ShopUI {
  constructor(game) {
    this.g = game;
    this.el = $('#shop');
    this.el.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        this.tab = tab.dataset.tab;
        this.render();
      }
      const buy = e.target.closest('[data-buy]');
      if (buy) this.buy(buy.dataset.buy);
      const sell = e.target.closest('[data-sell]');
      if (sell) this.sell(sell.dataset.sell);
    });
  }

  open(shopId) {
    this.id = shopId;
    this.shop = SHOPS[shopId];
    this.tab = 'buy';
    this.el.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.el.classList.add('hidden');
  }

  // Tools and tomes are single purchases.
  available(id) {
    const it = ITEMS[id], g = this.g;
    if (it.type === 'tool' && g.inventory.has(id)) return false;
    if (id === 'tent' && g.tent) return false;
    if (it.type === 'tome' && (g.inventory.has(id) || g.flags.embersRead)) return false;
    return true;
  }

  sellable() {
    const g = this.g, p = g.player, buys = this.shop.buys;
    return g.inventory.entries().filter(([id, n]) => {
      const it = ITEMS[id];
      if (!it?.value || it.type === 'key') return false;
      if (buys !== 'all' && !buys.includes(it.type)) return false;
      // Don't sell the only copy of something you're wearing or holding.
      const equipped = p.equipment.weapon === id || p.equipment.armor === id;
      return !(equipped && n <= 1);
    });
  }

  buy(id) {
    const g = this.g, price = ITEMS[id].value;
    if (g.coins < price) return g.hud.toast("You can't afford that.", 'warn');
    g.coins -= price;
    g.giveItem(id, 1, false);
    g.hud.toast(`Bought ${ITEMS[id].icon} ${ITEMS[id].name} for 🪙 ${price}.`, 'loot');
    this.render();
  }

  sell(id) {
    const g = this.g, price = sellPrice(id);
    if (!g.inventory.remove(id)) return;
    g.coins += price;
    g.hud.toast(`Sold ${ITEMS[id].name} for 🪙 ${price}.`, 'loot');
    this.render();
  }

  render() {
    const g = this.g;
    this.el.querySelector('.shop-name').textContent = this.shop.name;
    this.el.querySelector('.shop-coins').textContent = `🪙 ${g.coins}`;
    this.el.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('on', t.dataset.tab === this.tab));
    const stat = (it) => it.damage ? `+${it.damage} attack · ${it.reach} reach`
      : it.defense ? `+${it.defense} defense` : it.heal ? `Restores ${it.heal} HP` : it.mana ? `Restores ${it.mana} mana` : '';
    let rows;
    if (this.tab === 'buy') {
      rows = this.shop.stock.filter((id) => this.available(id)).map((id) => {
        const it = ITEMS[id], afford = g.coins >= it.value;
        const owned = g.inventory.count(id);
        return `<div class="shop-row"><span class="icon">${it.icon}</span>
          <div class="info"><b>${it.name}</b>${owned ? ` <span class="owned">(own ${owned})</span>` : ''}<small>${stat(it) || it.desc}</small></div>
          <button class="${afford ? 'primary' : ''}" data-buy="${id}" ${afford ? '' : 'disabled'}>🪙 ${it.value}</button></div>`;
      });
      if (!rows.length) rows = ['<p class="empty">Sold out of anything you need.</p>'];
    } else {
      rows = this.sellable().map(([id, n]) => {
        const it = ITEMS[id];
        return `<div class="shop-row"><span class="icon">${it.icon}</span>
          <div class="info"><b>${it.name}</b> <span class="owned">×${n}</span><small>${stat(it) || it.desc}</small></div>
          <button data-sell="${id}">Sell 🪙 ${sellPrice(id)}</button></div>`;
      });
      if (!rows.length) rows = ['<p class="empty">Nothing this merchant wants to buy.</p>'];
    }
    this.el.querySelector('.shop-list').innerHTML = rows.join('');
  }
}
