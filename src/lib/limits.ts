// Límites de los campos de formulario. Se usan en el HTML (maxlength, min,
// max) de los formularios.
export const L = {
  name: { min: 2, max: 120 },
  company: { min: 2, max: 160 },
  email: { max: 254 },
  phone: { min: 6, max: 32 },
  volume: { min: 1, max: 120 },
  needs: { max: 2000 },
  message: { min: 10, max: 3000 },
  taxId: { max: 32 },
  address: { min: 3, max: 160 },
  city: { min: 2, max: 80 },
  postal: { min: 2, max: 16 },
  region: { max: 80 },
  notes: { max: 1000 },
  qty: { min: 1, max: 999 },
  cartLines: { max: 20 },
} as const;

// Válido también con el flag "v" que usan los navegadores en el atributo pattern.
export const PHONE_PATTERN = '[+0-9 \\(\\)\\-\\.]{6,32}';
export const PHONE_RE = /^[+0-9 ()\-.]{6,32}$/;
