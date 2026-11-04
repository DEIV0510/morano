-- Esquema inicial de Morano Europe.
-- Importes en céntimos de euro (enteros). Fechas en milisegundos UNIX.

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  code            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('direct', 'quote')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  sort            INTEGER NOT NULL DEFAULT 0,
  name_es         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  subtitle_es     TEXT NOT NULL DEFAULT '',
  subtitle_en     TEXT NOT NULL DEFAULT '',
  description_es  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  features_es     TEXT NOT NULL DEFAULT '[]',
  features_en     TEXT NOT NULL DEFAULT '[]',
  applications_es TEXT NOT NULL DEFAULT '[]',
  applications_en TEXT NOT NULL DEFAULT '[]',
  photo           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS variants (
  id                  INTEGER PRIMARY KEY,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL UNIQUE,
  label_es            TEXT NOT NULL,
  label_en            TEXT NOT NULL,
  grams               INTEGER NOT NULL CHECK (grams > 0),
  price_cents         INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
  stock               INTEGER CHECK (stock IS NULL OR stock >= 0),
  low_stock_threshold INTEGER CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort                INTEGER NOT NULL DEFAULT 0,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS variants_product ON variants(product_id);

-- Imágenes subidas desde el panel: se re-codifican a WebP (sin metadatos) y
-- se guardan en la base de datos para que el sitio funcione igual en un VPS
-- o en serverless sin disco persistente.
CREATE TABLE IF NOT EXISTS media (
  id          TEXT PRIMARY KEY,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  color       TEXT,
  created_at  INTEGER NOT NULL,
  created_by  INTEGER
);
CREATE TABLE IF NOT EXISTS media_variants (
  media_id  TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  width     INTEGER NOT NULL,
  data      BLOB NOT NULL,
  PRIMARY KEY (media_id, width)
);
CREATE TABLE IF NOT EXISTS product_images (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id    TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  alt_es      TEXT NOT NULL DEFAULT '',
  alt_en      TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id                    INTEGER PRIMARY KEY,
  ref                   TEXT NOT NULL UNIQUE,
  access_hash           TEXT NOT NULL,
  idempotency_key       TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
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
  stock_applied         INTEGER NOT NULL DEFAULT 0,
  internal_notes        TEXT NOT NULL DEFAULT '',
  ip_hash               TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id                INTEGER PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INTEGER,
  variant_id        INTEGER,
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

CREATE TABLE IF NOT EXISTS quotes (
  id            INTEGER PRIMARY KEY,
  ref           TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','quoted','won','lost','archived')),
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
  internal_notes TEXT NOT NULL DEFAULT '',
  ip_hash       TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_status ON quotes(status, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY,
  ref           TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  full_name     TEXT NOT NULL,
  company       TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'es',
  crm_status    TEXT NOT NULL DEFAULT 'disabled',
  internal_notes TEXT NOT NULL DEFAULT '',
  ip_hash       TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_status ON messages(status, created_at);

-- Textos corporativos editables desde el panel (sobrescriben los textos por defecto).
CREATE TABLE IF NOT EXISTS content (
  key         TEXT NOT NULL,
  locale      TEXT NOT NULL CHECK (locale IN ('es','en')),
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  updated_by  INTEGER,
  PRIMARY KEY (key, locale)
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  updated_by  INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name                 TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('admin','manager','sales','viewer')),
  password_hash        TEXT NOT NULL,
  active               INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  mfa_secret_enc       TEXT,
  mfa_enabled          INTEGER NOT NULL DEFAULT 0,
  mfa_last_step        INTEGER NOT NULL DEFAULT 0,
  failed_count         INTEGER NOT NULL DEFAULT 0,
  locked_until         INTEGER NOT NULL DEFAULT 0,
  password_changed_at  INTEGER NOT NULL,
  last_login_at        INTEGER,
  created_at           INTEGER NOT NULL
);

-- Sesiones: en la cookie viaja un token aleatorio; aquí solo su hash SHA-256.
CREATE TABLE IF NOT EXISTS sessions (
  id_hash      TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf         TEXT NOT NULL,
  mfa_pending  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  ip_hash      TEXT,
  user_agent   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY,
  at          INTEGER NOT NULL,
  user_id     INTEGER,
  user_email  TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  detail      TEXT NOT NULL DEFAULT '{}',
  ip_hash     TEXT
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at);

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

CREATE TABLE IF NOT EXISTS email_log (
  id          INTEGER PRIMARY KEY,
  at          INTEGER NOT NULL,
  recipient   TEXT NOT NULL,
  template    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error       TEXT NOT NULL DEFAULT '',
  related     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS email_log_at ON email_log(at);
