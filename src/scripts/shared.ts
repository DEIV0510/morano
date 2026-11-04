// Utilidades compartidas por los scripts del navegador.
export interface ShopItem {
  n: string; // producto
  l: string; // presentación
  p: number; // precio en céntimos
}

export interface I18n {
  locale: 'es' | 'en';
  strings: Record<string, string>;
  home: string;
  whatsapp: string;
  shop: { items: Record<string, ShopItem>; vatBp: number; vatIncluded: boolean; shipping: number | null; freeFrom: number | null };
}

let cached: I18n | undefined;
export function i18n(): I18n {
  if (cached) return cached;
  const el = document.getElementById('me-i18n');
  cached = JSON.parse(el?.textContent || '{}') as I18n;
  return cached;
}

export const tr = (key: string) => i18n().strings[key] ?? key;

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const whatsappUrl = (text: string) => `https://wa.me/${i18n().whatsapp}?text=${encodeURIComponent(text)}`;

/** Abre WhatsApp en otra pestaña; si el navegador lo bloquea, en la misma. */
export function openWhatsApp(text: string): string {
  const url = whatsappUrl(text);
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
  else location.href = url;
  return url;
}

/** Abre un <dialog> modal y devuelve el foco al disparador al cerrar. */
export function openDialog(d: HTMLDialogElement | null, trigger?: Element | null) {
  if (!d || d.open) return;
  d.showModal();
  const back = trigger instanceof HTMLElement ? trigger : (document.activeElement as HTMLElement | null);
  d.addEventListener(
    'close',
    () => {
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    },
    { once: true }
  );
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
