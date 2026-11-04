// Utilidades compartidas por los scripts del navegador.
export interface I18n {
  locale: 'es' | 'en';
  strings: Record<string, string>;
  checkout: string;
  home: string;
}

let cached: I18n | undefined;
export function i18n(): I18n {
  if (cached) return cached;
  const el = document.getElementById('me-i18n');
  cached = el ? (JSON.parse(el.textContent || '{}') as I18n) : { locale: 'es', strings: {}, checkout: '/es/finalizar-compra', home: '/es/' };
  return cached;
}

export const tr = (key: string, vars: Record<string, string> = {}) => {
  let s = i18n().strings[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
};

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function postJson<T = any>(url: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* respuesta sin JSON */
  }
  return { status: res.status, data };
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
