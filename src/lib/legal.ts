// Textos legales (LSSI-CE, RGPD/LOPDGDD, cookies y condiciones de compra).
// Los datos societarios (NIF, registro, correo) se toman de Ajustes; si faltan,
// no se muestran. Deben revisarse por el asesor legal de la empresa antes de publicar.
import { contact } from './config.ts';
import type { Locale } from './i18n.ts';
import { ROUTES } from './i18n.ts';
import type { Settings } from './settings.ts';

export type LegalKey = 'legal' | 'privacy' | 'cookies' | 'terms';
type Block = { h: string; p?: string[]; ul?: string[]; table?: string[][] };
export interface LegalDoc {
  title: string;
  blocks: Block[];
}

const UPDATED = '2026-11-03';

function identity(s: Settings, l: Locale): string[] {
  const es = l === 'es';
  return [
    `${es ? 'Titular' : 'Owner'}: ${s.legalName}`,
    ...(s.taxId ? [`NIF: ${s.taxId}`] : []),
    `${es ? 'Domicilio' : 'Registered address'}: ${contact.address}`,
    ...(s.registry ? [`${es ? 'Datos registrales' : 'Registry details'}: ${s.registry}`] : []),
    ...(s.publicEmail ? [`${es ? 'Correo electrónico' : 'Email'}: ${s.publicEmail}`] : []),
    `WhatsApp: ${contact.whatsapp}`,
    `Web: ${contact.web}`,
  ];
}

export function legalDoc(key: LegalKey, l: Locale, s: Settings): LegalDoc {
  const es = l === 'es';
  const rights = es
    ? s.publicEmail
      ? `escribiendo a ${s.publicEmail} o por correo postal a ${contact.address}`
      : `por correo postal a ${contact.address} o mediante el formulario de contacto de este sitio`
    : s.publicEmail
      ? `by writing to ${s.publicEmail} or by post to ${contact.address}`
      : `by post to ${contact.address} or through the contact form on this website`;

  if (key === 'legal') {
    return es
      ? {
          title: 'Aviso legal',
          blocks: [
            { h: 'Datos identificativos', p: ['En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:'], ul: identity(s, l) },
            { h: 'Objeto', p: ['Este sitio presenta la actividad de Morano Europe, plataforma comercial europea de Morano Gruppo, dedicada a la comercialización internacional de aceites y grasas vegetales, y permite solicitar cotizaciones y comprar determinados productos en línea.'] },
            { h: 'Propiedad intelectual e industrial', p: ['Los logotipos, marcas, fotografías, textos y el diseño de este sitio pertenecen a Morano Europe o a las empresas de Morano Gruppo. Queda prohibida su reproducción, distribución o transformación sin autorización expresa.'] },
            { h: 'Responsabilidad', p: ['Morano Europe procura que la información publicada sea exacta y esté actualizada. Las especificaciones técnicas de cada producto se facilitan bajo solicitud y prevalecen sobre las descripciones generales del sitio. Morano Europe no responde de los contenidos de sitios de terceros enlazados desde esta web.'] },
            { h: 'Legislación aplicable', p: ['Este aviso legal se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa aplicable.'] },
          ],
        }
      : {
          title: 'Legal notice',
          blocks: [
            { h: 'Company details', p: ['In accordance with Spanish Law 34/2002 on Information Society Services and E-commerce (LSSI-CE), the owner of this website is:'], ul: identity(s, l) },
            { h: 'Purpose', p: ['This website presents the activity of Morano Europe, the European commercial platform of Morano Gruppo, dedicated to the international trade of vegetable oils and fats, and allows visitors to request quotations and buy selected products online.'] },
            { h: 'Intellectual and industrial property', p: ['The logos, trademarks, photographs, texts and design of this website belong to Morano Europe or to the companies of Morano Gruppo. Reproduction, distribution or transformation without express authorisation is prohibited.'] },
            { h: 'Liability', p: ['Morano Europe strives to keep the published information accurate and up to date. Technical specifications for each product are provided on request and prevail over the general descriptions on this website. Morano Europe is not responsible for the content of third-party websites linked from this site.'] },
            { h: 'Governing law', p: ['This legal notice is governed by Spanish law. Any dispute shall be submitted to the competent courts under the applicable regulations.'] },
          ],
        };
  }

  if (key === 'privacy') {
    return es
      ? {
          title: 'Política de privacidad',
          blocks: [
            { h: 'Responsable del tratamiento', ul: identity(s, l) },
            {
              h: 'Qué datos tratamos y para qué',
              table: [
                ['Finalidad', 'Datos', 'Base jurídica'],
                ['Responder solicitudes de cotización y mensajes de contacto', 'Nombre, empresa, correo, teléfono, país, producto, volumen y mensaje', 'Consentimiento y aplicación de medidas precontractuales (art. 6.1.a y 6.1.b RGPD)'],
                ['Gestionar pedidos, pagos, envíos y facturación', 'Datos de contacto, dirección de entrega, NIF/VAT y detalle del pedido', 'Ejecución del contrato y obligación legal (art. 6.1.b y 6.1.c RGPD)'],
                ['Seguridad del sitio y prevención del fraude y del abuso', 'Dirección IP seudonimizada y registros técnicos', 'Interés legítimo (art. 6.1.f RGPD)'],
              ],
            },
            { h: 'Pagos con tarjeta', p: ['Los pagos con tarjeta los procesa Stripe en su pasarela segura. Morano Europe no recibe ni almacena los datos de la tarjeta; solo conserva la referencia del pago para conciliar el pedido.'] },
            { h: 'Destinatarios', p: ['No cedemos datos a terceros salvo obligación legal. Acceden a ellos, como encargados del tratamiento y solo en la medida necesaria, los proveedores de alojamiento web, correo electrónico, pagos (Stripe) y, en su caso, la herramienta de gestión comercial de la empresa.'] },
            { h: 'Plazos de conservación', p: ['Las solicitudes y mensajes se conservan mientras exista una relación comercial o, en su defecto, durante un máximo de dos años. Los datos de pedidos y facturación se conservan durante los plazos que exige la normativa mercantil y tributaria. Los registros técnicos de seguridad se conservan un máximo de doce meses.'] },
            { h: 'Sus derechos', p: [`Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad ${rights}, indicando el derecho que ejerce. También puede retirar su consentimiento en cualquier momento y presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).`] },
            { h: 'Seguridad', p: ['Aplicamos medidas técnicas y organizativas adecuadas: conexión cifrada (HTTPS), acceso restringido al panel de administración con autenticación reforzada, registro de actividad y copias de seguridad.'] },
          ],
        }
      : {
          title: 'Privacy policy',
          blocks: [
            { h: 'Data controller', ul: identity(s, l) },
            {
              h: 'What data we process and why',
              table: [
                ['Purpose', 'Data', 'Legal basis'],
                ['Answering quotation requests and contact messages', 'Name, company, email, phone, country, product, volume and message', 'Consent and pre-contractual steps (Art. 6(1)(a) and 6(1)(b) GDPR)'],
                ['Managing orders, payments, shipping and invoicing', 'Contact details, delivery address, VAT/tax ID and order details', 'Performance of a contract and legal obligation (Art. 6(1)(b) and 6(1)(c) GDPR)'],
                ['Website security and prevention of fraud and abuse', 'Pseudonymised IP address and technical logs', 'Legitimate interest (Art. 6(1)(f) GDPR)'],
              ],
            },
            { h: 'Card payments', p: ['Card payments are processed by Stripe on its secure checkout. Morano Europe never receives or stores card details; we only keep the payment reference to reconcile the order.'] },
            { h: 'Recipients', p: ['We do not share data with third parties unless legally required. Our web hosting, email, payment (Stripe) and, where applicable, sales management providers access data as processors, only to the extent necessary.'] },
            { h: 'Retention', p: ['Requests and messages are kept while a business relationship exists or, otherwise, for up to two years. Order and invoicing data are kept for the periods required by commercial and tax law. Technical security logs are kept for up to twelve months.'] },
            { h: 'Your rights', p: [`You may exercise your rights of access, rectification, erasure, objection, restriction and portability ${rights}, stating the right you wish to exercise. You may withdraw consent at any time and lodge a complaint with the Spanish Data Protection Agency (www.aepd.es).`] },
            { h: 'Security', p: ['We apply appropriate technical and organisational measures: encrypted connections (HTTPS), restricted access to the administration panel with strong authentication, activity logging and backups.'] },
          ],
        };
  }

  if (key === 'cookies') {
    const rows = es
      ? [
          ['Nombre', 'Tipo', 'Finalidad', 'Duración'],
          ['me_intro', 'Cookie técnica propia', 'Recordar que ya se mostró la animación de carga en esta visita', 'Sesión'],
          ['morano_cart_v1', 'Almacenamiento local propio', 'Guardar los productos del carrito', 'Hasta que vacíe el carrito'],
          ['morano_checkout_key', 'Almacenamiento de sesión propio', 'Evitar pedidos duplicados si se envía el formulario dos veces', 'Sesión'],
          ['__Host-morano_admin', 'Cookie técnica propia', 'Mantener la sesión del panel de administración (solo personal autorizado)', 'Hasta 12 horas'],
        ]
      : [
          ['Name', 'Type', 'Purpose', 'Duration'],
          ['me_intro', 'First-party technical cookie', 'Remember that the loading animation has already been shown during this visit', 'Session'],
          ['morano_cart_v1', 'First-party local storage', 'Keep the products in your cart', 'Until you empty the cart'],
          ['morano_checkout_key', 'First-party session storage', 'Prevent duplicate orders if the form is submitted twice', 'Session'],
          ['__Host-morano_admin', 'First-party technical cookie', 'Keep the administration panel session (authorised staff only)', 'Up to 12 hours'],
        ];
    return es
      ? {
          title: 'Política de cookies',
          blocks: [
            { h: 'Qué utilizamos', p: ['Este sitio solo utiliza cookies y almacenamiento local técnicos, necesarios para su funcionamiento. No usamos cookies de análisis, publicidad ni seguimiento, por lo que no se requiere su consentimiento (art. 22.2 LSSI-CE).'], table: rows },
            { h: 'Servicios de terceros', p: ['Si paga con tarjeta, la pasarela de Stripe puede usar sus propias cookies en su dominio para procesar el pago y prevenir el fraude. Al pulsar el botón de WhatsApp o Instagram se abre el servicio correspondiente, que aplica su propia política.'] },
            { h: 'Cómo eliminarlas', p: ['Puede borrar las cookies y el almacenamiento local desde la configuración de su navegador. Si lo hace, se vaciará el carrito.'] },
          ],
        }
      : {
          title: 'Cookie policy',
          blocks: [
            { h: 'What we use', p: ['This website only uses technical cookies and local storage that are necessary for it to work. We do not use analytics, advertising or tracking cookies, so your consent is not required (Art. 22.2 LSSI-CE).'], table: rows },
            { h: 'Third-party services', p: ['If you pay by card, Stripe’s checkout may use its own cookies on its domain to process the payment and prevent fraud. The WhatsApp and Instagram buttons open those services, which apply their own policies.'] },
            { h: 'How to delete them', p: ['You can delete cookies and local storage in your browser settings. Doing so will empty your cart.'] },
          ],
        };
  }

  // Condiciones de compra
  const vat = es
    ? s.pricesIncludeVat
      ? `Los precios se muestran en euros e incluyen el IVA aplicable (${s.vatRateBp / 100} %).`
      : `Los precios se muestran en euros sin IVA; el IVA aplicable (${s.vatRateBp / 100} %) se añade en el resumen del pedido.`
    : s.pricesIncludeVat
      ? `Prices are shown in euros and include applicable VAT (${s.vatRateBp / 100} %).`
      : `Prices are shown in euros excluding VAT; applicable VAT (${s.vatRateBp / 100} %) is added in the order summary.`;
  return es
    ? {
        title: 'Condiciones de compra',
        blocks: [
          { h: 'Vendedor', ul: identity(s, l) },
          { h: 'Ámbito', p: ['Estas condiciones regulan la compra en línea de los productos disponibles para compra directa en este sitio (aceite crudo de palmiste, CPKO, y torta de palmiste, PKE, en sus distintas presentaciones). El resto de productos se suministran bajo cotización y acuerdo comercial específico.'] },
          { h: 'Precios', p: [vat, 'El importe final, con envío e impuestos, se muestra antes de confirmar el pedido. Los precios y existencias se validan en el momento de la compra.'] },
          { h: 'Proceso de compra', p: ['Seleccione la presentación y la cantidad, añada los productos al carrito y complete los datos de contacto y entrega. Recibirá un correo con la referencia del pedido.'] },
          { h: 'Pago', p: ['Pago con tarjeta: se realiza en la pasarela segura de Stripe y el pedido se confirma cuando Stripe notifica el cobro. Pedido con factura proforma: cuando el pago con tarjeta no está disponible, el pedido queda registrado sin cargo y el equipo comercial envía la proforma con el importe final, el envío y las instrucciones de pago.'] },
          { h: 'Envío y entrega', p: ['El coste de envío se indica en el resumen del pedido o, en los pedidos con proforma, en la propia proforma. El plazo de entrega se comunica al confirmar el pedido.'] },
          { h: 'Desistimiento', p: ['Si compra como consumidor, dispone de 14 días naturales desde la entrega para desistir sin indicar el motivo, comunicándolo por los medios de contacto indicados. Se exceptúan los productos precintados que no puedan devolverse por razones de protección de la salud o de higiene una vez desprecintados (art. 103 del Real Decreto Legislativo 1/2007). Las compras realizadas por empresas o profesionales para su actividad no tienen derecho de desistimiento.'] },
          { h: 'Garantía y reclamaciones', p: ['Los productos se entregan conforme a lo descrito. Para cualquier incidencia, contacte con nosotros indicando la referencia del pedido.'] },
          { h: 'Legislación aplicable', p: ['Estas condiciones se rigen por la legislación española, sin perjuicio de los derechos que la normativa de consumo reconozca al comprador consumidor.'] },
        ],
      }
    : {
        title: 'Terms of sale',
        blocks: [
          { h: 'Seller', ul: identity(s, l) },
          { h: 'Scope', p: ['These terms govern the online purchase of the products available for direct purchase on this website (crude palm kernel oil, CPKO, and palm kernel expeller, PKE, in their different pack sizes). All other products are supplied on quotation and under a specific commercial agreement.'] },
          { h: 'Prices', p: [vat, 'The final amount, including shipping and taxes, is shown before you confirm the order. Prices and stock are validated at the time of purchase.'] },
          { h: 'Ordering', p: ['Select the pack size and quantity, add the products to your cart and enter your contact and delivery details. You will receive an email with your order reference.'] },
          { h: 'Payment', p: ['Card payment: processed on Stripe’s secure checkout; the order is confirmed once Stripe notifies the payment. Order with proforma invoice: when card payment is not available, the order is registered without charge and our commercial team sends a proforma invoice with the final amount, shipping and payment instructions.'] },
          { h: 'Shipping and delivery', p: ['Shipping costs are shown in the order summary or, for proforma orders, on the proforma invoice. The delivery time is communicated when the order is confirmed.'] },
          { h: 'Right of withdrawal', p: ['If you buy as a consumer, you have 14 calendar days from delivery to withdraw without giving a reason, by notifying us through the contact details above. Sealed goods that are not suitable for return due to health protection or hygiene reasons once unsealed are excluded (Art. 103 of Spanish Royal Legislative Decree 1/2007). Purchases made by businesses or professionals for their activity carry no right of withdrawal.'] },
          { h: 'Warranty and complaints', p: ['Products are delivered as described. For any issue, please contact us quoting your order reference.'] },
          { h: 'Governing law', p: ['These terms are governed by Spanish law, without prejudice to the rights granted to consumers by consumer protection law.'] },
        ],
      };
}

export const LEGAL_UPDATED = UPDATED;
export const legalAlternates = (key: LegalKey) => ({ es: ROUTES[key].es, en: ROUTES[key].en });
