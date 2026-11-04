-- Esquema de Morano Europe (sin panel administrativo).
-- Productos, precios y ajustes viven en src/data/*.ts; la base de datos solo
-- guarda lo que generan los clientes y la seguridad de la tienda.
-- Importes en céntimos de euro (enteros). Fechas en milisegundos UNIX.

CREATE TABLE IF NOT EXISTS orders (
  id                    INTEGER PRIMARY KEY,
  ref                   TEXT NOT NULL UNIQUE,
  access_hash           TEXT NOT NULL,
  idempotency_key       TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL CHECK (status IN ('pending','paid','refunded')),
  payment_method        TEXT NOT NULL CHECK (payment_method IN ('stripe','proforma')),
  currency              TEXT NOT NULL DEFAULT 'EUR',
  subtotal_cents        INTEGER NOT NULL,
  shipping_cents        INTEGER,
  vat_rate_bp           INTEGER NOT NULL,
  vat_included          INTEGER NOT NULL,
  vat_cents             INTEGER NOT NULL,
  total_cents           INTEGER NOT NULL,
  customer_name         TEXT NOT NULL,
  company               TEXT NOT NULL DEFAULT '',
  tax_id                TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  address_line1         TEXT NOT NULL,
  address_line2         TEXT NOT NULL DEFAULT '',
  city                  TEXT NOT NULL,
  postal_code           TEXT NOT NULL,
  region                TEXT NOT NULL DEFAULT '',
  country               TEXT NOT NULL,
  notes                 TEXT NOT NULL DEFAULT '',
  locale                TEXT NOT NULL DEFAULT 'es',
  stripe_session_id     TEXT UNIQUE,
  stripe_payment_intent TEXT,
  paid_at               INTEGER,
  ip_hash               TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_payment_intent ON orders(stripe_payment_intent);

CREATE TABLE IF NOT EXISTS order_items (
  id                INTEGER PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_slug      TEXT NOT NULL,
  sku               TEXT NOT NULL,
  product_name      TEXT NOT NULL,
  variant_label     TEXT NOT NULL,
  unit_price_cents  INTEGER NOT NULL,
  qty               INTEGER NOT NULL CHECK (qty > 0),
  line_total_cents  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id          INTEGER PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at          INTEGER NOT NULL,
  actor       TEXT NOT NULL,
  type        TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  note        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id, at);

-- Copia de seguridad de cotizaciones y mensajes (además del correo al buzón comercial).
CREATE TABLE IF NOT EXISTS quotes (
  id            INTEGER PRIMARY KEY,
  ref           TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  company       TEXT NOT NULL,
  email         TEXT NOT NULL,
  country       TEXT NOT NULL,
  phone         TEXT NOT NULL,
  product_slug  TEXT NOT NULL,
  product_label TEXT NOT NULL,
  volume        TEXT NOT NULL,
  needs         TEXT NOT NULL DEFAULT '',
  locale        TEXT NOT NULL DEFAULT 'es',
  crm_status    TEXT NOT NULL DEFAULT 'disabled',
  ip_hash       TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_created ON quotes(created_at);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY,
  ref           TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  company       TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'es',
  crm_status    TEXT NOT NULL DEFAULT 'disabled',
  ip_hash       TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL,
  reset_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  received_at   INTEGER NOT NULL,
  order_ref     TEXT
);
