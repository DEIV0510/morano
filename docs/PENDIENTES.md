# Pendientes que requieren a la empresa

Nada de esto impide publicar: cada punto tiene un comportamiento seguro mientras falta.

- **Precios** de las 10 presentaciones de CPKO y PKE (`src/data/catalogo.ts`). Mientras sean `null` se muestra «Precio a consultar» y el botón abre la cotización por WhatsApp.
- **Envío**: coste por pedido o envío gratis desde un importe (`src/data/ajustes.ts`). Sin él, el carrito indica «Se confirma por WhatsApp».
- **IVA**: por defecto 21 % incluido en el precio. Confirmar con el asesor fiscal.
- **Datos legales**: NIF, datos registrales y correo público (`src/data/ajustes.ts`) para el aviso legal, la privacidad y las condiciones de compra.
- **Fichas técnicas** de los productos: el cliente las envía (2026-11-05). Mientras tanto no se publica ninguna especificación.
- **Textos de producto**: redactados solo con información documentada (brief y moranogruppo.com). Validarlos con las fichas técnicas.
- **Fotografías de producto** de CPKO y PKE envasados (el brief las menciona; no llegaron).
- **Dominio**: apuntar `moranoeurope.com` a Vercel cuando la web esté aprobada (hoy es un WordPress en Hostinger).
- **Revisión del inglés** por un hablante nativo (`src/lib/copy.ts`).
