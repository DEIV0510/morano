// Checkout: resumen con importes del servidor y creación del pedido.
import * as cart from './cart-store.ts';
import { esc, i18n, postJson, tr } from './shared.ts';
import { totalsHtml } from './cart.ts';

const { locale } = i18n();
const form = document.querySelector<HTMLFormElement>('[data-checkout]');

if (form) {
  const lines = form.querySelector<HTMLElement>('[data-co-lines]')!;
  const totals = form.querySelector<HTMLElement>('[data-co-totals]')!;
  const empty = form.querySelector<HTMLElement>('[data-co-empty]')!;
  const notice = form.querySelector<HTMLElement>('[data-co-notice]')!;
  const pay = form.querySelector<HTMLElement>('[data-co-pay]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-co-submit]')!;
  const note = form.querySelector<HTMLElement>('[data-co-note]')!;
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;

  // Clave de idempotencia por visita al checkout: un doble envío no duplica el pedido.
  const keyName = 'morano_checkout_key';
  let idem = sessionStorage.getItem(keyName) || '';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(idem)) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    idem = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try {
      sessionStorage.setItem(keyName, idem);
    } catch {
      /* sin almacenamiento de sesión */
    }
  }

  const paint = (data: cart.PricedResponse | null) => {
    const items = data?.lines ?? [];
    empty.hidden = items.length > 0;
    pay.hidden = items.length === 0;
    notice.hidden = !data?.issues.length;
    if (data?.issues.length) notice.textContent = tr('cart.updated');
    lines.innerHTML = items
      .map(
        (l) => `<li class="cart-line"><div><p class="cart-line__name">${esc(l.productCode)} — ${esc(l.productName)}</p>
        <p class="cart-line__meta">${l.qty} × ${esc(l.variantLabel)} · ${esc(l.unit)}</p></div><p class="cart-line__total num">${esc(l.total)}</p></li>`
      )
      .join('');
    totals.innerHTML = data && items.length ? totalsHtml(data.totals) : '';
    if (data) {
      const card = data.paymentMode === 'stripe';
      submit.innerHTML = `${esc(tr(card ? 'checkout.payCard' : 'checkout.proforma'))} <svg class="icon arrow" viewBox="0 0 15 10" width="16" height="10" aria-hidden="true"><path d="M0 5h14M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
      note.textContent = tr(card ? 'checkout.payCardNote' : 'checkout.proformaNote');
    }
  };

  const load = async () => {
    if (!cart.load().length) return paint(null);
    try {
      paint(await cart.price(locale));
    } catch {
      notice.hidden = false;
      notice.textContent = tr('cart.error');
    }
  };
  load();

  form.addEventListener('input', (e) => {
    const f = e.target as HTMLInputElement;
    if (f.getAttribute('aria-invalid') === 'true' && f.checkValidity()) f.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    let firstBad: HTMLElement | null = null;
    form.querySelectorAll<HTMLInputElement>('input, select, textarea').forEach((f) => {
      if (!f.name || f.type === 'hidden') return;
      if (f.checkValidity()) f.removeAttribute('aria-invalid');
      else {
        f.setAttribute('aria-invalid', 'true');
        firstBad ??= f;
      }
    });
    if (firstBad) {
      status.dataset.kind = 'error';
      status.textContent = tr('form.error');
      (firstBad as HTMLElement).focus();
      return;
    }
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? '');
    const body = {
      items: cart.load(),
      locale,
      idempotencyKey: idem,
      acceptTerms: fd.get('acceptTerms') === '1',
      customer: {
        fullName: s('fullName'),
        company: s('company'),
        taxId: s('taxId'),
        email: s('email'),
        phone: s('phone'),
        address1: s('address1'),
        address2: s('address2'),
        city: s('city'),
        postalCode: s('postalCode'),
        region: s('region'),
        country: s('country'),
        notes: s('notes'),
      },
    };
    const label = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = tr('checkout.processing');
    try {
      const { status: code, data } = await postJson('/api/checkout', body);
      if (code === 200 && data.ok && typeof data.redirect === 'string') {
        cart.clear();
        try {
          sessionStorage.removeItem(keyName);
        } catch {
          /* nada */
        }
        location.assign(data.redirect);
        return;
      }
      if (code === 409) {
        await load();
        status.dataset.kind = 'error';
        status.textContent = tr('cart.updated');
      } else if (code === 422 && data.fields) {
        for (const k of Object.keys(data.fields)) {
          const f = form.elements.namedItem(k.split('.').pop() || k);
          if (f instanceof HTMLElement) f.setAttribute('aria-invalid', 'true');
        }
        status.dataset.kind = 'error';
        status.textContent = tr('form.error');
      } else if (code === 429) {
        status.dataset.kind = 'error';
        status.textContent = tr('form.errorRate');
      } else {
        status.dataset.kind = 'error';
        status.textContent = tr('checkout.error');
      }
    } catch {
      status.dataset.kind = 'error';
      status.textContent = tr('checkout.error');
    }
    submit.disabled = false;
    submit.innerHTML = label;
  });
}
