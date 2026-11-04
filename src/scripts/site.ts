// Interacciones del sitio público. Sin dependencias.
import { openDialog, postJson, reduceMotion, tr } from './shared.ts';

const html = document.documentElement;
html.classList.add('js');
const reduce = reduceMotion();

/* ── Pantalla de carga: sale cuando la imagen principal está lista ── */
const loader = document.querySelector<HTMLElement>('[data-loader]');
if (loader) {
  const heroImg = document.querySelector<HTMLImageElement>('[data-hero-img]');
  const elapsed = performance.now();
  const ready = heroImg && !heroImg.complete ? heroImg.decode().catch(() => undefined) : Promise.resolve();
  const atLeast = new Promise((r) => setTimeout(r, Math.max(0, 850 - elapsed)));
  const atMost = new Promise((r) => setTimeout(r, Math.max(0, 1800 - elapsed)));
  Promise.race([Promise.all([ready, atLeast]), atMost]).then(() => {
    loader.classList.add('is-out');
    setTimeout(() => loader.remove(), 900);
  });
}

/* ── Cabecera: transparente sobre el hero, sólida al desplazarse ── */
const header = document.querySelector<HTMLElement>('[data-header]');
if (header) {
  const overlay = header.dataset.overlay === 'true';
  let lastY = scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = scrollY;
    if (overlay) header.dataset.solid = y > 40 ? 'true' : 'false';
    const menuOpen = document.querySelector('dialog[open]');
    header.dataset.hidden = !menuOpen && y > 640 && y > lastY + 4 ? 'true' : y < lastY - 4 || y < 640 ? 'false' : header.dataset.hidden || 'false';
    lastY = y;
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
  header.addEventListener('focusin', () => (header.dataset.hidden = 'false'));
}

/* ── Diálogos: menú móvil, cotización, carrito ── */
const menu = document.getElementById('mobile-menu') as HTMLDialogElement | null;
const quote = document.getElementById('quote-dialog') as HTMLDialogElement | null;

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const menuOpen = t.closest('[data-menu-open]');
  if (menuOpen) openDialog(menu, menuOpen);
  if (t.closest('[data-menu-close]') && menu?.open) menu.close();

  const q = t.closest<HTMLElement>('[data-quote-open]');
  if (q) {
    e.preventDefault();
    prepareQuote(q);
    if (menu?.open) menu.close();
    openDialog(quote, q);
  }
  const close = t.closest('[data-dialog-close]');
  if (close) close.closest('dialog')?.close();

  // Clic en el fondo de un diálogo modal = cerrar.
  if (t instanceof HTMLDialogElement && t.open) {
    const r = t.getBoundingClientRect();
    const ev = e as MouseEvent;
    const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if (!inside) t.close();
  }
});

function fillCountries(select: HTMLSelectElement | null) {
  if (!select || select.options.length > 1) return;
  const loc = select.dataset.locale || 'es';
  const names = new Intl.DisplayNames([loc], { type: 'region' });
  const opts = (select.dataset.codes || '')
    .split(' ')
    .filter(Boolean)
    .map((code) => ({ code, name: names.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name, loc));
  for (const o of opts) select.add(new Option(o.name, o.code));
}

function prepareQuote(trigger: HTMLElement) {
  if (!quote) return;
  fillCountries(quote.querySelector<HTMLSelectElement>('[data-country-select]'));
  const form = quote.querySelector<HTMLFormElement>('form');
  const done = quote.querySelector<HTMLElement>('[data-form-done]');
  if (form && done && !done.hidden) {
    form.hidden = false;
    done.hidden = true;
    form.reset();
  }
  const slug = trigger.dataset.product;
  const select = quote.querySelector<HTMLSelectElement>('[data-quote-product]');
  if (select && slug && [...select.options].some((o) => o.value === slug)) select.value = slug;
  // "Consultar precio" desde un producto: rellena el volumen con la selección actual.
  const buy = trigger.closest<HTMLElement>('[data-buy]');
  const vol = quote.querySelector<HTMLInputElement>('[data-quote-volume]');
  if (buy && vol && trigger.hasAttribute('data-ask-price')) {
    const sel = buy.querySelector<HTMLInputElement>('input[type=radio]:checked');
    const qty = buy.querySelector<HTMLInputElement>('[data-qty]')?.value || '1';
    if (sel) vol.value = `${qty} × ${sel.dataset.label}`;
  }
}

/* ── Selector de idioma: conserva la sección actual ── */
document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]').forEach((a) => {
  a.addEventListener('click', () => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    try {
      const map = JSON.parse(a.dataset.hashMap || '{}') as Record<string, string>;
      if (map[hash]) a.hash = map[hash];
    } catch {
      /* sin correspondencia */
    }
  });
});

/* ── Entradas al hacer scroll ── */
const io = new IntersectionObserver(
  (entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target as HTMLElement;
      if (el.dataset.delay) el.style.setProperty('--d', `${el.dataset.delay}ms`);
      el.classList.add('is-in');
      io.unobserve(el);
      if (el.matches('[data-count-wrap], .stats__item')) el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
);
document.querySelectorAll<HTMLElement>('.reveal, .reveal-mask').forEach((el) => {
  // La propia máscara hereda el retraso del contenedor (galería en parejas).
  const holder = el.closest<HTMLElement>('[data-delay]');
  if (holder && !el.dataset.delay) el.dataset.delay = holder.dataset.delay;
  io.observe(el);
});

/* ── Contadores ── */
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count || 0);
  if (reduce || !target) return;
  const dur = 1400;
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = String(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

/* ── Parallax sutil del hero ── */
const parallax = document.querySelector<HTMLElement>('[data-parallax]');
if (parallax && !reduce) {
  const factor = Number(parallax.dataset.parallax || 0.15);
  let active = true;
  new IntersectionObserver(([en]) => (active = en.isIntersecting)).observe(parallax.parentElement!);
  let raf = 0;
  addEventListener('scroll', () => {
    if (!active || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      parallax.style.transform = `translate3d(0, ${(scrollY * factor).toFixed(1)}px, 0)`;
    });
  }, { passive: true });
}

/* ── Mapa: dibuja la ruta al entrar y pausa fuera de pantalla ── */
const map = document.querySelector<HTMLElement>('[data-map]');
if (map) {
  const motion = map.querySelector<SVGAnimateMotionElement>('animateMotion');
  const svg = map.querySelector<SVGSVGElement>('svg');
  let started = false;
  new IntersectionObserver(
    ([en]) => {
      if (en.isIntersecting) {
        map.classList.add('is-in');
        map.classList.remove('is-paused');
        if (!reduce) {
          if (!started) {
            started = true;
            setTimeout(() => motion?.beginElement(), 2400);
          } else svg?.unpauseAnimations();
        }
      } else if (started) {
        map.classList.add('is-paused');
        svg?.pauseAnimations();
      }
    },
    { threshold: 0.25 }
  ).observe(map);
}

/* ── Navegación activa según la sección visible ── */
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.site-nav a')];
if (navLinks.length && document.body.dataset.overlayHeader === 'true') {
  const byId = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const a = byId.get(en.target.id);
        if (!a) continue;
        if (en.isIntersecting) {
          navLinks.forEach((l) => l.removeAttribute('aria-current'));
          a.setAttribute('aria-current', 'true');
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  byId.forEach((_, id) => {
    const s = document.getElementById(id);
    if (s) spy.observe(s);
  });
}

/* ── Formularios de cotización y contacto ── */
document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const wrap = form.parentElement!;
  const done = wrap.querySelector<HTMLElement>('[data-form-done]');
  const doneText = wrap.querySelector<HTMLElement>('[data-form-done-text]');
  const kind = form.dataset.form as 'quote' | 'contact';

  form.addEventListener('input', (e) => {
    const f = e.target as HTMLInputElement;
    if (f.getAttribute('aria-invalid') === 'true' && f.checkValidity()) f.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const setStatus = (msg: string, kindMsg: 'error' | 'info' = 'info') => {
      if (!status) return;
      status.textContent = msg;
      status.dataset.kind = kindMsg;
    };
    const fields = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')].filter(
      (f) => f.name && f.type !== 'hidden' && !f.closest('.hp')
    );
    let firstBad: HTMLElement | null = null;
    for (const f of fields) {
      const ok = f.checkValidity();
      if (ok) f.removeAttribute('aria-invalid');
      else {
        f.setAttribute('aria-invalid', 'true');
        firstBad ??= f;
      }
    }
    if (firstBad) {
      setStatus(tr('form.error'), 'error');
      firstBad.focus();
      return;
    }

    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    fd.forEach((v, k) => (body[k] = typeof v === 'string' ? v : ''));
    body.consent = fd.get('consent') === '1';
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
    const label = btn?.innerHTML ?? '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = tr('common.sending');
    }
    setStatus('');
    try {
      const { status: code, data } = await postJson(form.action, body);
      if (code === 200 && data.ok) {
        if (doneText) doneText.textContent = tr(kind === 'quote' ? 'quote.successText' : 'contact.successText', { ref: data.ref });
        form.hidden = true;
        if (done) {
          done.hidden = false;
          done.focus();
        }
        form.reset();
        return;
      }
      if (code === 422 && data.fields) {
        for (const name of Object.keys(data.fields)) {
          const f = form.elements.namedItem(name.split('.')[0]);
          if (f instanceof HTMLElement) f.setAttribute('aria-invalid', 'true');
        }
        setStatus(tr('form.error'), 'error');
      } else if (code === 429) setStatus(tr('form.errorRate'), 'error');
      else if (code === 400 && data.error === 'spam') setStatus(tr('form.errorSpam'), 'error');
      else setStatus(tr('form.errorServer'), 'error');
    } catch {
      setStatus(tr('form.errorServer'), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    }
  });
});
