# Morano Europe — plataforma corporativa y tienda B2B

Sitio web de **MORANO EUROPE SL**, plataforma comercial europea de Morano Gruppo.
*From the Palm to the World.*

- Web corporativa bilingüe (ES/EN) con dirección de arte propia y fotografías reales del grupo.
- Tienda de compra directa para **CPKO** y **PKE** (500 g · 1 kg · 2 kg · 5 kg · 20 kg).
- Catálogo bajo cotización (CPO, RBD Palm Oil, Olein, Stearin, RBD PKO, Specialty Fats, PFAD, aceites envasados, marca privada).
- **Sin panel administrativo**: productos, precios, ajustes y textos se editan en archivos del proyecto; pedidos, cotizaciones y mensajes llegan por correo al buzón comercial (y, opcionalmente, a un CRM).

| Documento | Contenido |
| --- | --- |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Puesta en producción paso a paso (servidor, dominio, HTTPS, Cloudflare, Stripe, correo) |
| [docs/SEGURIDAD.md](docs/SEGURIDAD.md) | Medidas implementadas, copias de seguridad y plan de respuesta a incidentes |
| [docs/DISENO.md](docs/DISENO.md) | Dirección de arte y sistema de diseño |
| [docs/PENDIENTES.md](docs/PENDIENTES.md) | Lo que necesita credenciales o decisiones de la empresa |

---

## Cómo se gestiona la web (sin panel)

| Qué | Dónde se cambia |
| --- | --- |
| Productos, presentaciones y **precios** | [src/data/catalogo.ts](src/data/catalogo.ts) — `precio: null` muestra «Precio a consultar» y deriva a cotización |
| IVA, envío, pago con tarjeta y datos legales (NIF, registro, correo público) | [src/data/ajustes.ts](src/data/ajustes.ts) |
| Textos de la web en ES y EN | [src/lib/copy.ts](src/lib/copy.ts) (secciones) e [src/lib/i18n.ts](src/lib/i18n.ts) (interfaz) |
| Fotografías | `_material/fotos` + `npm run images` |

Tras cualquier cambio: `npm run build` y reiniciar el servidor (o desplegar). Cada pedido, cotización o mensaje genera un correo completo al buzón comercial (`SALES_EMAIL`) con *Responder a* del cliente, y se guarda además en la base de datos como copia.

## Arquitectura

```
Navegador ──HTTPS──► Cloudflare (WAF, DDoS, caché)  ──►  Node 24 · server.mjs
                                                          ├─ Astro 7 (SSR) ── páginas ES/EN y API /api/*
                                                          ├─ src/data/*.ts ── catálogo, precios y ajustes
                                                          ├─ libSQL / SQLite ── pedidos, cotizaciones, mensajes, límites
                                                          ├─ Stripe Checkout (API REST + webhook firmado)
                                                          ├─ SMTP (correo transaccional y avisos comerciales)
                                                          └─ Webhook CRM opcional (firmado HMAC)
```

- **Renderizado en servidor** (Astro 7, adaptador Node): HTML completo para SEO y velocidad; JavaScript mínimo sin frameworks (≈5 KB comprimidos en las páginas públicas).
- **Separación frontend/backend**: la lógica de negocio vive en `src/lib/` (TypeScript puro, ejecutable también con Node en las pruebas). Las páginas y endpoints solo la llaman.
- **Validación compartida**: los límites de cada campo (`src/lib/limits.ts`) se usan en los atributos del HTML y en los esquemas Zod del servidor (`src/lib/validation.ts`).
- **Importes siempre en el servidor**: el navegador envía solo SKU y cantidad; precios, IVA y envío se recalculan en `src/lib/pricing.ts` con `src/data/`.
- **Errores centralizados**: `src/lib/http.ts` convierte cualquier error en una respuesta segura (sin trazas) y lo registra con `src/lib/log.ts` (con redacción de secretos).

## Tecnologías

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Framework | Astro 7 + `@astrojs/node` | SSR rápido, cero JS por defecto, rutas por archivo |
| Lenguaje | TypeScript estricto | Tipos en servidor y cliente (`astro check` sin errores) |
| Base de datos | libSQL (`@libsql/client`) | SQLite en un VPS o Turso gestionado, mismo código |
| Validación | Zod (incluido en Astro) | Esquemas declarativos en el servidor |
| Correo | nodemailer (SMTP) | Funciona con cualquier proveedor |
| Compresión | compression | Brotli/gzip en `server.mjs` |
| Imágenes (compilación) | sharp | AVIF/WebP/JPEG responsivos de las fotos originales |

Firmas HMAC de Stripe, tokens antispam y seudonimización de IP usan `node:crypto`, sin dependencias adicionales.

## Estructura

```
├─ server.mjs                 Servidor de producción (compresión, caché, timeouts, cabeceras de proxy)
├─ astro.config.mjs
├─ db/migrations/             Esquema SQL versionado
├─ public/                    Fuentes, imágenes optimizadas, logotipos, favicons
├─ scripts/
│  ├─ build-images.mjs        Optimiza las fotos de _material/fotos → public/img
│  ├─ brand/                  Vectorización del logotipo y mapa de puntos
│  ├─ db-migrate.mjs          Migraciones
│  └─ db-backup.mjs           Copia de seguridad en caliente (VACUUM INTO)
├─ src/
│  ├─ data/
│  │  ├─ catalogo.ts          Productos, presentaciones y precios
│  │  └─ ajustes.ts           IVA, envío, pago con tarjeta y datos legales
│  ├─ middleware.ts           CSP y cabeceras de seguridad
│  ├─ lib/                    Lógica de negocio y seguridad
│  ├─ components/ · layouts/  Interfaz
│  ├─ pages/
│  │  ├─ es/ · en/            Web pública con URLs localizadas
│  │  ├─ api/                 cart · checkout · quote · contact · orders/retry · webhooks/stripe
│  │  └─ sitemap.xml · robots.txt
│  ├─ scripts/                JS del navegador (site, cart, checkout)
│  └─ styles/                 Sistema de diseño (base.css, site.css)
├─ tests/
│  ├─ unit/                   Firmas, antispam, catálogo, importes, validación
│  └─ api/                    Webhook de Stripe y seguridad HTTP de extremo a extremo
└─ _material/                 Material original del cliente (fotos y logotipo; el brief no se versiona)
```

## Puesta en marcha local

```bash
npm install
cp .env.example .env          # y rellenar APP_SECRET como mínimo
npm run db:migrate            # crea la base de datos
npm run dev                   # http://localhost:4321  (desarrollo)
```

Producción local: `npm run build && npm start`.

## Variables de entorno

Todas en [.env.example](.env.example). Obligatoria: `APP_SECRET` (≥ 32 caracteres). El resto activa integraciones; sin ellas la web funciona y lo indica honestamente (pedido con proforma, correo «no enviado» en el log).

| Variable | Uso |
| --- | --- |
| `SITE_URL` | URL canónica (SEO, correos, retorno de Stripe). También se lee al compilar: define los dominios admitidos en la comprobación de origen. Con `https://` activa HSTS. |
| `APP_SECRET` | Firma tokens antispam y seudonimiza IPs. |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | `file:data/morano.db` (VPS) o `libsql://…` (Turso). |
| `TRUST_PROXY` | `1` solo con un proxy/CDN de confianza delante; con `0`, `server.mjs` descarta las cabeceras `X-Forwarded-*`. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Pagos con tarjeta. |
| `SMTP_*`, `MAIL_FROM` | Correo transaccional. |
| `SALES_EMAIL` / `ALERT_EMAIL` | **Buzón comercial (recibe pedidos, cotizaciones y mensajes)** / alertas de seguridad. |
| `CRM_WEBHOOK_URL` / `CRM_WEBHOOK_SECRET` | Envío de cotizaciones, mensajes y pedidos al CRM. |

## Base de datos

Solo guarda lo que generan los clientes y la seguridad: pedidos (+ líneas y eventos), cotizaciones, mensajes, límites de peticiones y eventos de Stripe. Esquema en [db/migrations/0001_init.sql](db/migrations/0001_init.sql).

- **VPS**: archivo SQLite en `data/` (modo WAL). Copias: `npm run db:backup` programado a diario (ver [docs/SEGURIDAD.md](docs/SEGURIDAD.md)).
- **Turso**: `DATABASE_URL=libsql://<db>.turso.io` + `DATABASE_AUTH_TOKEN`.
- Consultar registros sin panel: `sqlite3 data/morano.db "SELECT ref, customer_name, total_cents/100.0, status FROM orders ORDER BY created_at DESC LIMIT 20;"`.

## Pagos (Stripe)

Flujo: el servidor crea el pedido con sus propios importes → Stripe Checkout (página alojada; la web nunca ve la tarjeta) → **el pedido solo pasa a «pagado» con el webhook firmado** `checkout.session.completed`, tras comprobar importe y moneda. La redirección del navegador no confirma nada. Los reembolsos totales hechos en Stripe marcan el pedido como «reembolsado».

- Idempotencia: clave por visita al checkout (sin pedidos duplicados por doble clic) e `Idempotency-Key` en cada llamada a Stripe; eventos deduplicados por id.
- Sin claves de Stripe, con el envío sin definir o con `pagoConTarjeta: false` en `src/data/ajustes.ts`, el pedido se registra **sin cargo** y el buzón comercial recibe el aviso para enviar la factura proforma. Nunca se simula un cobro.
- Envío, seguimiento y facturación se gestionan desde el correo (respondiendo al aviso, que lleva el correo del cliente como *Responder a*) y desde el panel de Stripe.

Configuración paso a paso en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md#5-stripe).

## Correo

SMTP de cualquier proveedor (Hostinger, Google Workspace, Microsoft 365, Brevo, SES…). Es **imprescindible** en producción: al no haber panel, el buzón comercial es donde llegan pedidos, cotizaciones y mensajes. Correos: confirmación de pedido al cliente, aviso de pedido al comercial, pago confirmado (cliente y comercial), acuse y aviso de cotización y de contacto, alertas de seguridad. Cada envío queda registrado en el log del servidor (`where: "mail"`).

## Pruebas

```bash
npm test                                     # unitarias (seguridad, catálogo, importes, validación)
node --test tests/api/stripe-webhook.test.mjs  # integración del webhook con BD aislada
npm run build && npm start                   # en otra terminal
TEST_BASE_URL=http://localhost:4321 npm run test:api   # seguridad HTTP de extremo a extremo
npx astro check                              # tipos
npm audit --omit=dev                         # vulnerabilidades en dependencias
```

Resultados (3 nov 2026): 18/18 unitarias, 5/5 webhook, 9/9 seguridad HTTP, `astro check` 0 errores, `npm audit` 0 vulnerabilidades. Compra completa probada en navegador con precios temporales de prueba (retirados después). Lighthouse móvil de la portada 98/100/100/100; escritorio 100 en las cuatro categorías.

## Despliegue

Resumen (detalle en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)):

1. Servidor con Node 24 (VPS, Hostinger con Node.js, Render, Railway, Fly…).
2. `.env` de producción → `npm ci && npm run build && npm run db:migrate`.
3. `npm start` bajo systemd o PM2, detrás de Cloudflare/Caddy/nginx con HTTPS y `TRUST_PROXY=1`.
4. Stripe (claves + webhook), SMTP, `SALES_EMAIL` y copias programadas.

## Seguridad

Resumen de [docs/SEGURIDAD.md](docs/SEGURIDAD.md): sin panel ni cuentas de usuario (menos superficie de ataque), CSP estricta sin `unsafe-inline`, HSTS, anti-clickjacking, CSRF por origen, límites por IP y endpoint en BD, consultas parametrizadas, validación y saneado de toda entrada, antispam, precios solo del servidor, webhooks firmados, alertas, logs sin secretos y copias de seguridad. Ninguna web es invulnerable: estas medidas reducen el riesgo frente a ataques habituales y deben acompañarse de un WAF/CDN, actualizaciones y revisión periódica.
