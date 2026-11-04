// Módulos de compra (presentación, cantidad, precio) y panel del carrito.
import * as cart from './cart-store.ts';
import { esc, i18n, openDialog, openWhatsApp, tr } from './shared.ts';
import { formatMoney } from '../lib/pricing.ts';

const { locale } = i18n();
const drawer = document.getElementById('cart-drawer') as HTMLDialogElement | null;
const countEls = document.querySelectorAll<HTMLElement>('[data-cart-count]');

function renderCount(items = cart.load()) {
  const n = cart.count(items);
  countEls.forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}
renderCount();
cart.onChange(renderCount);
// Sincroniza entre pestañas abiertas.
addEventListener('storage', (e) => {
  if (e.key === 'morano_cart_v2') renderCount();
});

/* ── Módulos de compra ── */
document.querySelectorAll<HTMLElement>('[data-buy]').forEach((buy) => {
  const radios = [...buy.querySelectorAll<HTMLInputElement>('input[type=radio]')];
  const qty = buy.querySelector<HTMLInputElement>('[data-qty]')!;
  const price = buy.querySelector<HTMLElement>('[data-price-display]')!;
  const note = buy.querySelector<HTMLElement>('[data-price-note]')!;
  const addBtn = buy.querySelector<HTMLButtonElement>('[data-add-to-cart]')!;
  const askBtn = buy.querySelector<HTMLButtonElement>('[data-ask-price]')!;
  const added = buy.querySelector<HTMLElement>('[data-added]')!;

  const selected = () => radios.find((r) => r.checked);
  const clampQty = () => {
    const v = Math.round(Number(qty.value));
    qty.value = String(Number.isFinite(v) ? Math.min(999, Math.max(1, v)) : 1);
  };

  function sync() {
    const r = selected();
    if (!r) return;
    const hasPrice = Boolean(r.dataset.price);
    price.textContent = r.dataset.priceLabel || '';
    note.hidden = !hasPrice;
    addBtn.hidden = !hasPrice;
    askBtn.hidden = hasPrice;
    clampQty();
    added.textContent = '';
  }

  radios.forEach((r) => r.addEventListener('change', sync));
  buy.querySelector('[data-qty-dec]')?.addEventListener('click', () => {
    qty.value = String(Number(qty.value) - 1);
    clampQty();
  });
  buy.querySelector('[data-qty-inc]')?.addEventListener('click', () => {
    qty.value = String(Number(qty.value) + 1);
    clampQty();
  });
  qty.addEventListener('change', clampQty);

  addBtn.addEventListener('click', () => {
    const r = selected();
    if (!r || !r.dataset.price) return;
    clampQty();
    cart.add(r.value, Number(qty.value));
    added.textContent = tr('shop.added');
    openDrawer(addBtn);
  });
  sync();
});


/* ── Panel del carrito ── */
const linesEl = drawer?.querySelector<HTMLUListElement>('[data-cart-lines]');
const emptyEl = drawer?.querySelector<HTMLElement>('[data-cart-empty]');
const footEl = drawer?.querySelector<HTMLElement>('[data-cart-foot]');
const totalsEl = drawer?.querySelector<HTMLElement>('[data-cart-totals]');
const money = (c: number) => formatMoney(c, locale);
const rate = (bp: number) => `${(bp / 100).toLocaleString(locale)} %`;

function shippingText(s: number | null) {
  return s === null ? tr('cart.shippingPending') : s === 0 ? tr('cart.shippingFree') : money(s);
}

function paint() {
  if (!linesEl || !emptyEl || !footEl || !totalsEl) return;
  const p = cart.priced();
  emptyEl.hidden = p.lines.length > 0;
  footEl.hidden = p.lines.length === 0;
  linesEl.innerHTML = p.lines
    .map(
      (l) => `
      <li class="cart-line" data-sku="${esc(l.sku)}">
        <div>
          <p class="cart-line__name">${esc(l.name)}</p>
          <p class="cart-line__meta">${esc(l.label)} · ${esc(money(l.unitCents))}</p>
        </div>
        <p class="cart-line__total num">${esc(money(l.lineCents))}</p>
        <div class="cart-line__controls">
          <div class="qty">
            <button type="button" class="qty__btn" data-line-dec aria-label="${esc(tr('shop.decrease'))}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="1.5"/></svg></button>
            <input class="qty__input num" type="number" min="1" max="999" value="${l.qty}" inputmode="numeric" aria-label="${esc(tr('shop.quantity'))}" data-line-qty>
            <button type="button" class="qty__btn" data-line-inc aria-label="${esc(tr('shop.increase'))}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5"/></svg></button>
          </div>
          <button type="button" class="cart-line__remove" data-line-remove>${esc(tr('cart.remove'))}</button>
        </div>
      </li>`
    )
    .join('');
  totalsEl.innerHTML = `
    <dt>${esc(tr('cart.subtotal'))}</dt><dd class="num">${esc(money(p.subtotal))}</dd>
    <dt>${esc(tr('cart.shipping'))}</dt><dd>${esc(shippingText(p.shipping))}</dd>
    <dt>${esc(p.vatIncluded ? tr('cart.vatIncludedLine') : tr('cart.vat'))} (${esc(rate(p.vatBp))})</dt><dd class="num">${esc(money(p.vatCents))}</dd>
    <dt class="totals__total">${esc(tr('cart.total'))}</dt><dd class="totals__total num">${esc(money(p.totalCents))}</dd>`;
}

/** Mensaje de WhatsApp con el pedido. */
function orderMessage() {
  const p = cart.priced();
  const lines = p.lines.map((l) => `• ${l.qty} × ${l.name} (${l.label}) — ${money(l.lineCents)}`);
  return [
    tr('wa.order'),
    '',
    ...lines,
    '',
    `${tr('cart.subtotal')}: ${money(p.subtotal)}`,
    `${tr('cart.shipping')}: ${shippingText(p.shipping)}`,
    `${tr('cart.total')}: ${money(p.totalCents)} (${p.vatIncluded ? tr('cart.vatIncludedLine') : `${tr('cart.vat')} ${rate(p.vatBp)}`})`,
  ].join('\n');
}

drawer?.querySelector('[data-cart-send]')?.addEventListener('click', () => {
  if (cart.priced().lines.length) openWhatsApp(orderMessage());
});

linesEl?.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const li = t.closest<HTMLElement>('[data-sku]');
  if (!li) return;
  const sku = li.dataset.sku!;
  const input = li.querySelector<HTMLInputElement>('[data-line-qty]')!;
  if (t.closest('[data-line-remove]')) {
    cart.remove(sku);
    return paint();
  }
  const delta = t.closest('[data-line-inc]') ? 1 : t.closest('[data-line-dec]') ? -1 : 0;
  if (!delta) return;
  const next = Math.min(999, Math.max(0, Number(input.value) + delta));
  if (next === 0) cart.remove(sku);
  else cart.setQty(sku, next);
  paint();
});
linesEl?.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.matches('[data-line-qty]')) return;
  const li = input.closest<HTMLElement>('[data-sku]')!;
  const v = Math.round(Number(input.value));
  cart.setQty(li.dataset.sku!, Number.isFinite(v) ? Math.min(999, Math.max(0, v)) : 1);
  paint();
});

function openDrawer(trigger?: Element | null) {
  if (!drawer) return;
  paint();
  openDialog(drawer, trigger);
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-cart-open]');
  if (t) openDrawer(t);
});
