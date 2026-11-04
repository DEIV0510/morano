# Despliegue — Morano Europe

La web es una aplicación Node (no un WordPress ni una web estática). El dominio actual `moranoeurope.com` está en Hostinger con WordPress: el cambio de DNS solo debe hacerse cuando la nueva versión esté probada en producción.

## 1. Opciones de alojamiento

| Opción | Cuándo | Base de datos |
| --- | --- | --- |
| **VPS** (Hostinger VPS, Hetzner, DigitalOcean…) + Cloudflare | Recomendada: control total y coste bajo | SQLite en disco (`file:data/morano.db`) |
| Hostinger «Node.js apps» (planes Business/Cloud) | Si se quiere seguir en Hostinger sin VPS | Turso (el disco puede no ser persistente) |
| Render / Railway / Fly.io | Despliegue desde GitHub | Turso, o disco persistente del proveedor |

Requisitos: Node 24 LTS, 512 MB de RAM (1 GB recomendado; scrypt usa ~128 MB por inicio de sesión), HTTPS.

## 2. VPS paso a paso (Ubuntu)

```bash
# 1. Usuario y dependencias
sudo adduser --system --group --home /srv/morano morano
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs git
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# 2. Código
sudo -u morano git clone https://github.com/DEIV0510/morano.git /srv/morano/app
cd /srv/morano/app && sudo -u morano npm ci

# 3. Variables (archivo solo legible por el servicio). La compilación también las lee:
#    SITE_URL define los dominios admitidos en la comprobación de origen (CSRF).
sudo -u morano cp .env.example .env && sudo -u morano nano .env && sudo chmod 600 .env
#   SITE_URL=https://www.moranoeurope.com
#   HOST=127.0.0.1   PORT=4321   TRUST_PROXY=1
#   APP_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
sudo -u morano npm run build

# 4. Base de datos
sudo -u morano npm run db:migrate
```

Servicio systemd `/etc/systemd/system/morano.service`:

```ini
[Unit]
Description=Morano Europe
After=network.target

[Service]
User=morano
WorkingDirectory=/srv/morano/app
ExecStart=/usr/bin/node server.mjs
Restart=always
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/srv/morano/app/data /srv/morano/app/backups
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now morano
```

Proxy HTTPS con **Caddy** (`/etc/caddy/Caddyfile`), certificado automático:

```
www.moranoeurope.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:4321
}
moranoeurope.com {
  redir https://www.moranoeurope.com{uri} permanent
}
```

## 3. Cloudflare (DDoS, WAF, caché)

1. Añadir el dominio a Cloudflare y apuntar los registros A/AAAA al VPS con el proxy (nube naranja) activado.
2. SSL/TLS: **Full (strict)**. Activar «Always Use HTTPS» y HSTS.
3. Security: WAF Managed Rules, Bot Fight Mode. Regla de rate limiting: `/api/` 60/min por IP.
4. Caché: respetar las cabeceras del origen (los archivos `/_astro/*` ya llevan caché inmutable; `/img`, `/fonts` y `/brand` 30 días; el HTML se revalida siempre).
5. En el VPS, permitir el puerto 443 solo desde los rangos IP de Cloudflare (opcional, más seguro).

## 4. Turso (si no hay disco persistente)

```bash
turso db create morano-europe --location mad
turso db show morano-europe --url        # → DATABASE_URL=libsql://…
turso db tokens create morano-europe     # → DATABASE_AUTH_TOKEN=…
npm run db:migrate                       # con esas variables definidas
```

## 5. Stripe

1. Crear la cuenta de Stripe a nombre de **MORANO EUROPE SL** (requiere NIF, cuenta bancaria SEPA y verificación del representante).
2. Probar primero en **modo test**: `STRIPE_SECRET_KEY=sk_test_…`.
3. Developers → Webhooks → Add endpoint: `https://www.moranoeurope.com/api/webhooks/stripe` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`. Copiar el *signing secret* → `STRIPE_WEBHOOK_SECRET=whsec_…`.
4. En `src/data/ajustes.ts`: `envio` (euros, o 0 para gratis) y `pagoConTarjeta: true`; después `npm run build` y reiniciar. Sin envío definido, la web sigue registrando pedidos con proforma.
5. Prueba completa con la tarjeta de test `4242 4242 4242 4242`: la página del pedido debe pasar a «Pago confirmado» y deben llegar los correos de pago al cliente y al buzón comercial.
6. Cambiar a claves `sk_live_…` y crear el webhook también en modo live.

La sesión de Checkout no fija métodos de pago: los que se activen en el panel de Stripe (tarjeta, Apple Pay, Google Pay, SEPA u otros disponibles para España) aparecen sin tocar el código.

## 6. Correo

Ejemplo con el correo de Hostinger: `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_SECURE=1`, `SMTP_USER` y `SMTP_PASS` de un buzón como `no-reply@moranoeurope.com`, `MAIL_FROM=Morano Europe <no-reply@moranoeurope.com>`. Configurar **SPF, DKIM y DMARC** del dominio para que los correos no lleguen a spam. `SALES_EMAIL` = buzón que atiende pedidos y cotizaciones.

## 7. Actualizar la web

```bash
cd /srv/morano/app
sudo -u morano npm run db:backup
sudo -u morano git pull && sudo -u morano npm ci && sudo -u morano npm run build && sudo -u morano npm run db:migrate
sudo systemctl restart morano
```

## 8. Lista de comprobación antes de cambiar el DNS

- [ ] `SITE_URL` con `https://` y dominio definitivo.
- [ ] Verificación en dos pasos activada en GitHub, Stripe, Cloudflare, correo y hosting.
- [ ] Precios en `src/data/catalogo.ts`; envío, IVA y datos legales (NIF, registro, correo) en `src/data/ajustes.ts`.
- [ ] Textos revisados en ES y EN (`src/lib/copy.ts`) y fichas de producto validadas por la empresa.
- [ ] Stripe en modo test probado de extremo a extremo; luego claves live.
- [ ] SMTP y `SALES_EMAIL` probados con una cotización real (sin panel, el buzón comercial es donde llega todo).
- [ ] Copia de seguridad programada y una restauración probada.
- [ ] Cloudflare con WAF y reglas de rate limiting.
- [ ] Redirecciones 301 de las URLs antiguas de WordPress que tengan tráfico (si las hay) hacia `/es/` o `/en/`.
