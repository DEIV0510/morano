# Morano Europe — plataforma corporativa y tienda B2B

Sitio web de **MORANO EUROPE SL**, plataforma comercial europea de Morano Gruppo.
*From the Palm to the World.*

- Web corporativa bilingüe (ES/EN) con dirección de arte propia y fotografías reales del grupo.
- Tienda de compra directa para **CPKO** y **PKE** (500 g · 1 kg · 2 kg · 5 kg · 20 kg).
- Catálogo bajo cotización (CPO, RBD Palm Oil, Olein, Stearin, RBD PKO, Specialty Fats, PFAD, aceites envasados, marca privada).
- Panel privado con roles: pedidos, cotizaciones, mensajes, productos, precios, inventario, textos, ajustes, usuarios y auditoría.

| Documento | Contenido |
| --- | --- |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Puesta en producción paso a paso (servidor, dominio, HTTPS, Cloudflare, Stripe, correo) |
| [docs/SEGURIDAD.md](docs/SEGURIDAD.md) | Medidas implementadas, copias de seguridad y plan de respuesta a incidentes |
| [docs/DISENO.md](docs/DISENO.md) | Dirección de arte y sistema de diseño |
| [docs/PENDIENTES.md](docs/PENDIENTES.md) | Lo que necesita credenciales o decisiones de la empresa |

---

## Arquitectura

```
Navegador ──HTTPS──► Cloudflare (WAF, DDoS, caché)  ──►  Node 24 · server.mjs
                                                          ├─ Astro 7 (SSR) ── páginas ES/EN, panel /admin, API /api/*
                                                          ├─ libSQL / SQLite (archivo local o Turso)
                                                          ├─ Stripe Checkout (API REST + webhook firmado)
                                                          ├─ SMTP (correo transaccional)
                                                          └─ Webhook CRM opcional (firmado HMAC)
```

- **Renderizado en servidor** (Astro 7, adaptador Node): HTML completo para SEO y velocidad; JavaScript mínimo sin frameworks (≈5 KB comprimidos en las páginas públicas).
- **Separación frontend/backend**: la lógica de negocio vive en `src/lib/` (TypeScript puro, ejecutable también con Node en las pruebas). Las páginas y endpoints solo la llaman.
- **Validación compartida**: los límites de cada campo (`src/lib/limits.ts`) se usan en los atributos del HTML y en los esquemas Zod del servidor (`src/lib/validation.ts`).
- **Importes siempre en el servidor**: el navegador envía solo `variantId` y cantidad; precios, existencias, IVA y envío se recalculan en `src/lib/pricing.ts`.
- **Errores centralizados**: `src/lib/http.ts` convierte cualquier error en una respuesta segura (sin trazas) y lo registra con `src/lib/log.ts` (con redacción de secretos).

## Tecnologías

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Framework | Astro 7 + `@astrojs/node` | SSR rápido, cero JS por defecto, rutas por archivo |
| Lenguaje | TypeScript estricto | Tipos en servidor y cliente (`astro check` sin errores) |
| Base de datos | libSQL (`@libsql/client`) | SQLite en un VPS o Turso gestionado, mismo código |
| Validación | Zod (incluido en Astro) | Esquemas declarativos en el servidor |
| Imágenes | sharp | AVIF/WebP/JPEG responsivos; re-codificación de subidas |
| Correo | nodemailer (SMTP) | Funciona con cualquier proveedor |
| QR de MFA | uqr | Generación local del código QR (sin servicios externos) |
| Compresión | compression | Brotli/gzip en `server.mjs` |

Contraseñas (scrypt), TOTP, cifrado AES-GCM, firmas HMAC de Stripe y sesiones están implementados con `node:crypto`, sin dependencias adicionales.

## Estructura

```
├─ server.mjs                 Servidor de producción (compresión, caché, timeouts)
├─ astro.config.mjs
├─ db/migrations/             Esquema SQL versionado
├─ public/                    Fuentes, imágenes optimizadas, logotipos, favicons
├─ scripts/
│  ├─ build-images.mjs        Optimiza las fotos de _material/fotos → public/img
│  ├─ brand/                  Vectorización del logotipo y mapa de puntos
│  ├─ db-migrate.mjs          Migraciones + catálogo inicial
│  ├─ db-backup.mjs           Copia de seguridad en caliente (VACUUM INTO)
│  └─ create-admin.mjs        Alta/restablecimiento de usuarios del panel
├─ src/
│  ├─ middleware.ts           CSP y cabeceras, protección de /admin
│  ├─ lib/                    Lógica de negocio y seguridad (sin dependencias de Astro)
│  ├─ components/             Componentes de la web y del panel
│  ├─ layouts/                Base (web) y Admin (panel)
│  ├─ pages/
│  │  ├─ es/ · en/            Web pública con URLs localizadas
│  │  ├─ admin/               Panel privado
│  │  ├─ api/                 cart · checkout · quote · contact · orders/retry · webhooks/stripe
│  │  ├─ media/[file].ts      Imágenes subidas desde el panel
│  │  └─ sitemap.xml · robots.txt
│  ├─ scripts/                JS del navegador (site, cart, checkout, admin)
│  └─ styles/                 Sistema de diseño (base.css, site.css, admin.css)
├─ tests/
│  ├─ unit/                   Criptografía, TOTP, firmas, importes, validación
│  └─ api/                    Webhook de Stripe y seguridad HTTP de extremo a extremo
└─ _material/                 Material original del cliente (fotos y logotipo; el brief no se versiona)
```

## Puesta en marcha local

```bash
npm install
cp .env.example .env          # y rellenar APP_SECRET como mínimo
npm run db:migrate            # crea la base de datos y el catálogo inicial (sin precios)
npm run admin:create -- correo@empresa.com "Nombre" admin
npm run dev                   # http://localhost:4321  (desarrollo)
```

Producción local: `npm run build && npm start`.

## Variables de entorno

Todas en [.env.example](.env.example). Obligatoria: `APP_SECRET` (≥ 32 caracteres). El resto activa integraciones; sin ellas la web funciona y lo indica honestamente (pedido con proforma, correo «no enviado» en el registro).

| Variable | Uso |
| --- | --- |
| `SITE_URL` | URL canónica (SEO, correos, retorno de Stripe). Con `https://` activa cookies `Secure`, HSTS y `upgrade-insecure-requests`. |
| `APP_SECRET` | Firma tokens antispam, cifra secretos MFA y seudonimiza IPs. Si cambia, los usuarios deben reconfigurar MFA. |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | `file:data/morano.db` (VPS) o `libsql://…` (Turso). |
| `TRUST_PROXY` | `1` solo si hay un proxy/CDN de confianza delante. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Pagos con tarjeta. |
| `SMTP_*`, `MAIL_FROM` | Correo transaccional. |
| `SALES_EMAIL` / `ALERT_EMAIL` | Avisos comerciales / alertas de seguridad. |
| `CRM_WEBHOOK_URL` / `CRM_WEBHOOK_SECRET` | Envío de cotizaciones, mensajes y pedidos al CRM. |

## Base de datos

Tablas: productos, presentaciones, imágenes, pedidos (+ líneas y eventos), cotizaciones, mensajes, textos, ajustes, usuarios, sesiones, auditoría, límites de peticiones, eventos de Stripe y registro de correo. Esquema en [db/migrations/0001_init.sql](db/migrations/0001_init.sql).

- **VPS**: archivo SQLite en `data/` (modo WAL). Copias: `npm run db:backup` programado a diario (ver [docs/SEGURIDAD.md](docs/SEGURIDAD.md)).
- **Turso**: `DATABASE_URL=libsql://<db>.turso.io` + `DATABASE_AUTH_TOKEN`. Copias y restauración a un punto en el tiempo las gestiona Turso.
- Nuevas migraciones: añadir `db/migrations/0002_*.sql` y ejecutar `npm run db:migrate`.

## Pagos (Stripe)

Flujo: el servidor crea el pedido con sus propios importes → Stripe Checkout (página alojada; la web nunca ve la tarjeta) → **el pedido solo pasa a «pagado» con el webhook firmado** `checkout.session.completed`, tras comprobar importe y moneda. La redirección del navegador no confirma nada.

- Idempotencia: clave por visita al checkout (sin pedidos duplicados por doble clic) y `Idempotency-Key` en cada llamada a Stripe; eventos de Stripe deduplicados por id.
- Existencias: se descuentan al confirmarse el pago (actualización atómica) y se reponen en cancelaciones y reembolsos.
- Sin claves de Stripe, sin envío configurado o con el pago con tarjeta desactivado en Ajustes, el pedido se registra **sin cargo** y el equipo envía una factura proforma. Nunca se simula un cobro.

Configuración paso a paso en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md#5-stripe).

## Correo

SMTP de cualquier proveedor (Hostinger, Google Workspace, Microsoft 365, Brevo, SES…). Correos: confirmación de pedido, pago confirmado, cambios de estado, acuse de cotización y de contacto, avisos al buzón comercial y alertas de seguridad. Todo envío (o no envío) queda en **Panel → Actividad y correo**.

## Acceso administrativo

- URL: `https://<dominio>/admin` (no enlazada desde la web, `noindex`, fuera del sitemap y bloqueada en robots.txt).
- Primer usuario: `npm run admin:create -- correo "Nombre" admin` desde el servidor (la contraseña se pide oculta).
- Roles: **Administrador**, **Gestor de catálogo y contenidos**, **Comercial**, **Consulta**. Matriz de permisos en `src/lib/auth.ts`; se comprueba en el servidor en cada página y acción.
- Verificación en dos pasos (TOTP) en **Mi cuenta**. Recomendada para todos; imprescindible para administradores.

## Pruebas

```bash
npm test                                     # unitarias (seguridad, importes, validación)
node --test tests/api/stripe-webhook.test.mjs  # integración del webhook con BD aislada
npm run build && npm start                   # en otra terminal
TEST_BASE_URL=http://localhost:4321 npm run test:api   # seguridad HTTP de extremo a extremo
npx astro check                              # tipos
npm audit --omit=dev                         # vulnerabilidades en dependencias
```

Resultados de la entrega (3 nov 2026): 20/20 unitarias, 5/5 webhook, 13/13 seguridad HTTP, `astro check` 0 errores, `npm audit` 0 vulnerabilidades. Lighthouse (compilación de producción, local): portada móvil 99/100/100/100, escritorio 100/100/100/100; fichas de producto 100 en las cuatro categorías.

## Despliegue

Resumen (detalle en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)):

1. Servidor con Node 24 (VPS, Hostinger con Node.js, Render, Railway, Fly…).
2. `npm ci && npm run build && npm run db:migrate`.
3. Variables de entorno de producción (nunca en el repositorio).
4. `npm start` bajo un gestor de procesos (systemd o PM2) detrás de Cloudflare/Caddy/nginx con HTTPS.
5. Stripe: claves y endpoint de webhook. SMTP. Copias programadas.

## Seguridad

Resumen de [docs/SEGURIDAD.md](docs/SEGURIDAD.md): CSP estricta sin `unsafe-inline`, HSTS, anti-clickjacking, cookies `__Host-` HttpOnly/Secure/SameSite=Strict, CSRF (origen + token por sesión), scrypt, MFA TOTP, bloqueo progresivo por fuerza bruta, límites por IP y endpoint en BD, consultas parametrizadas, validación y saneado de toda entrada, subida de imágenes re-codificada, webhooks firmados, auditoría del panel, alertas, logs sin secretos y copias de seguridad. Ninguna web es invulnerable: estas medidas reducen el riesgo frente a ataques habituales y deben acompañarse de un WAF/CDN, actualizaciones y revisión periódica.
