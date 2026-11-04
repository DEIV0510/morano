# Pendientes que requieren a la empresa

Estado a 3 de noviembre de 2026. Nada de esto bloquea la web: cada punto tiene un comportamiento seguro mientras falta.

## Credenciales y cuentas

| Pendiente | Mientras tanto |
| --- | --- |
| **Hosting Node** + dominio apuntado (hoy `moranoeurope.com` es un WordPress en Hostinger) | La web corre en local / staging |
| **Cuenta de Stripe** de MORANO EUROPE SL (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) | Los pedidos se registran sin cargo y se gestiona con factura proforma |
| **SMTP** (`SMTP_*`, `MAIL_FROM`) + SPF/DKIM/DMARC | **Imprescindible**: sin panel, pedidos, cotizaciones y mensajes llegan por correo. Mientras falte, solo quedan en la base de datos y el log marca «no enviado» |
| **Buzón comercial** (`SALES_EMAIL`) y de alertas (`ALERT_EMAIL`) | Los avisos no llegan a nadie (quedan en la base de datos) |
| **CRM externo** (opcional, `CRM_WEBHOOK_URL`) | Basta con el correo comercial |
| **Cloudflare** (WAF, DDoS, rate limiting en el borde) | Solo actúan los límites de la aplicación |

## Datos de negocio (se escriben en `src/data/`; no hay panel)

- **Precios** de las 10 presentaciones de CPKO y PKE (`src/data/catalogo.ts`). Hasta entonces se muestra «Precio a consultar» y el botón abre la cotización.
- **Envío**: coste por pedido y, si se desea, envío gratis desde un importe (`src/data/ajustes.ts`). Sin él no se cobra con tarjeta.
- **IVA**: por defecto 21 % incluido en el precio. Confirmar con el asesor fiscal (ventas B2B intracomunitarias, inversión del sujeto pasivo, etc.).
- **Datos legales**: NIF, datos registrales y correo público (`src/data/ajustes.ts`) para el aviso legal, la privacidad y las condiciones de compra. Recomendado que un asesor legal revise esos textos.
- **Textos de producto**: descripciones, características y aplicaciones redactadas solo con información documentada (brief y moranogruppo.com). Validarlas y añadir especificaciones técnicas reales cuando existan.
- **Fotografías de producto** de CPKO y PKE en sus presentaciones (el brief las menciona; no se recibieron). Se añaden a `_material/fotos`, se registran en `scripts/build-images.mjs`, se optimizan con `npm run images` y se asignan en `src/data/catalogo.ts`.
- **Traducción al inglés**: redactada a mano en contexto; conviene una revisión nativa final (`src/lib/copy.ts`).

## Decisiones a confirmar

- Países a los que se venden los formatos pequeños (hoy el checkout acepta cualquier país y el coste de envío es único).
- Si se quieren métodos de pago adicionales de Stripe (SEPA, Apple Pay, Google Pay): se activan en Stripe.
- Correo público de contacto (no se publica ninguno hasta definirlo).
