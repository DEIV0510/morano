// Módulos de compra (presentación, cantidad, precio) y panel del carrito.
import * as cart from './cart-store.ts';
import { esc, i18n, openDialog, tr } from './shared.ts';

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
const body = drawer?.querySelector<HTMLElement>('[data-cart-body]');
const linesEl = drawer?.querySelector<HTMLUListElement>('[data-cart-lines]');
const emptyEl = drawer?.querySelector<HTMLElement>('[data-cart-empty]');
const footEl = drawer?.querySelector<HTMLElement>('[data-cart-foot]');
const totalsEl = drawer?.querySelector<HTMLElement>('[data-cart-totals]');
const noticeEl = drawer?.querySelector<HTMLElement>('[data-cart-notice]');

export function totalsHtml(t: cart.PricedResponse['totals']) {
  const shipping = t.shipping === null ? tr('cart.shippingPending') : t.shippingFree ? tr('cart.shippingFree') : t.shipping;
  return `
    <dt>${esc(tr('cart.subtotal'))}</dt><dd class="num">${esc(t.subtotal)}</dd>
    <dt>${esc(tr('cart.shipping'))}</dt><dd>${esc(shipping)}</dd>
    <dt>${esc(t.vatIncluded ? tr('cart.vatIncludedLine') : tr('cart.vat'))} (${esc(t.vatRate)})</dt><dd class="num">${esc(t.vat)}</dd>
    <dt class="totals__total">${esc(tr('cart.total'))}</dt><dd class="totals__total num">${esc(t.total)}</dd>`;
}

let pending = 0;
async function refresh() {
  if (!drawer || !linesEl) return;
  const items = cart.load();
  if (!items.length) return paint(null);
  const ticket = ++pending;
  body?.setAttribute('aria-busy', 'true');
  try {
    const data = await cart.price(locale);
    if (ticket !== pending) return;
    if (!data) {
      if (noticeEl) {
        noticeEl.hidden = false;
        noticeEl.textContent = tr('cart.error');
      }
      return;
    }
    paint(data);
  } catch {
    if (noticeEl) {
      noticeEl.hidden = false;
      noticeEl.textContent = tr('cart.error');
    }
  } finally {
    body?.removeAttribute('aria-busy');
  }
}

function paint(data: cart.PricedResponse | null) {
  if (!linesEl || !emptyEl || !footEl || !totalsEl || !noticeEl) return;
  const lines = data?.lines ?? [];
  emptyEl.hidden = lines.length > 0;
  footEl.hidden = lines.length === 0;
  noticeEl.hidden = !data?.issues.length;
  if (data?.issues.length) noticeEl.textContent = tr('cart.updated');
  linesEl.innerHTML = lines
    .map(
      (l) => `
      <li class="cart-line" data-sku="${esc(l.sku)}">
        <div>
          <p class="cart-line__name">${esc(l.productCode)} — ${esc(l.productName)}</p>
          <p class="cart-line__meta">${esc(l.variantLabel)} · ${esc(l.unit)}</p>
        </div>
        <p class="cart-line__total num">${esc(l.total)}</p>
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
  if (data) totalsEl.innerHTML = totalsHtml(data.totals);
}

let debounce = 0;
linesEl?.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const li = t.closest<HTMLElement>('[data-sku]');
  if (!li) return;
  const id = li.dataset.sku!;
  const input = li.querySelector<HTMLInputElement>('[data-line-qty]')!;
  const max = Number(input.max) || 999;
  if (t.closest('[data-line-remove]')) {
    cart.remove(id);
    refresh();
    return;
  }
  const delta = t.closest('[data-line-inc]') ? 1 : t.closest('[data-line-dec]') ? -1 : 0;
  if (!delta) return;
  const next = Math.min(max, Math.max(0, Number(input.value) + delta));
  input.value = String(next);
  if (next === 0) {
    cart.remove(id);
    refresh();
    return;
  }
  cart.setQty(id, next);
  clearTimeout(debounce);
  debounce = window.setTimeout(refresh, 350);
});
linesEl?.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.matches('[data-line-qty]')) return;
  const li = input.closest<HTMLElement>('[data-sku]')!;
  const v = Math.round(Number(input.value));
  cart.setQty(li.dataset.sku!, Number.isFinite(v) ? Math.min(Number(input.max) || 999, Math.max(0, v)) : 1);
  refresh();
});

function openDrawer(trigger?: Element | null) {
  if (!drawer) return;
  openDialog(drawer, trigger);
  refresh();
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-cart-open]');
  if (t) openDrawer(t);
});
