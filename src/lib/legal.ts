// Textos legales (LSSI-CE, RGPD/LOPDGDD, cookies y condiciones de compra).
// Los datos societarios (NIF, registro, correo) se toman de src/data/ajustes.ts;
// si faltan, no se muestran. Conviene que los revise el asesor legal de la empresa.
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

export const LEGAL_UPDATED = '2026-11-03';

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
    ? `${s.publicEmail ? `escribiendo a ${s.publicEmail}, ` : ''}por WhatsApp (${contact.whatsapp}) o por correo postal a ${contact.address}`
    : `${s.publicEmail ? `by writing to ${s.publicEmail}, ` : ''}via WhatsApp (${contact.whatsapp}) or by post to ${contact.address}`;

  if (key === 'legal') {
    return es
      ? {
          title: 'Aviso legal',
          blocks: [
            { h: 'Datos identificativos', p: ['En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:'], ul: identity(s, l) },
            { h: 'Objeto', p: ['Este sitio presenta la actividad de Morano Europe, plataforma comercial europea de Morano Gruppo, dedicada a la comercialización internacional de aceites y grasas vegetales, y permite solicitar cotizaciones y pedidos a través de WhatsApp.'] },
            { h: 'Propiedad intelectual e industrial', p: ['Los logotipos, marcas, fotografías, textos y el diseño de este sitio pertenecen a Morano Europe o a las empresas de Morano Gruppo. Queda prohibida su reproducción, distribución o transformación sin autorización expresa.'] },
            { h: 'Responsabilidad', p: ['Morano Europe procura que la información publicada sea exacta y esté actualizada. Las especificaciones técnicas de cada producto se facilitan bajo solicitud y prevalecen sobre las descripciones generales del sitio. Morano Europe no responde de los contenidos de sitios de terceros enlazados desde esta web.'] },
            { h: 'Legislación aplicable', p: ['Este aviso legal se rige por la legislación española.'] },
          ],
        }
      : {
          title: 'Legal notice',
          blocks: [
            { h: 'Company details', p: ['In accordance with Spanish Law 34/2002 on Information Society Services and E-commerce (LSSI-CE), the owner of this website is:'], ul: identity(s, l) },
            { h: 'Purpose', p: ['This website presents the activity of Morano Europe, the European commercial platform of Morano Gruppo, dedicated to the international trade of vegetable oils and fats, and allows visitors to request quotations and place orders via WhatsApp.'] },
            { h: 'Intellectual and industrial property', p: ['The logos, trademarks, photographs, texts and design of this website belong to Morano Europe or to the companies of Morano Gruppo. Reproduction, distribution or transformation without express authorisation is prohibited.'] },
            { h: 'Liability', p: ['Morano Europe strives to keep the published information accurate and up to date. Technical specifications for each product are provided on request and prevail over the general descriptions on this website. Morano Europe is not responsible for the content of third-party websites linked from this site.'] },
            { h: 'Governing law', p: ['This legal notice is governed by Spanish law.'] },
          ],
        };
  }

  if (key === 'privacy') {
    return es
      ? {
          title: 'Política de privacidad',
          blocks: [
            { h: 'Responsable del tratamiento', ul: identity(s, l) },
            { h: 'Qué datos tratamos y para qué', p: ['Este sitio no almacena datos personales en servidores propios. Los formularios de cotización y contacto y el carrito preparan un mensaje que usted envía por WhatsApp. Con ese mensaje recibimos los datos que decida incluir (nombre, empresa, país, correo, teléfono, producto, volumen y necesidades) y los tratamos únicamente para responder a su solicitud y, en su caso, gestionar el pedido, su facturación y el envío.'] },
            { h: 'Base jurídica', p: ['Su consentimiento al enviarnos el mensaje y la aplicación de medidas precontractuales o la ejecución del contrato (art. 6.1.a y 6.1.b RGPD); las obligaciones legales de facturación (art. 6.1.c RGPD).'] },
            { h: 'Destinatarios', p: ['No cedemos datos a terceros salvo obligación legal. Los mensajes se transmiten a través de WhatsApp (Meta), que aplica su propia política de privacidad.'] },
            { h: 'Plazos de conservación', p: ['Los datos de solicitudes se conservan mientras exista una relación comercial o, en su defecto, un máximo de dos años; los de pedidos y facturación, durante los plazos que exige la normativa mercantil y tributaria.'] },
            { h: 'Sus derechos', p: [`Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad ${rights}. También puede presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).`] },
          ],
        }
      : {
          title: 'Privacy policy',
          blocks: [
            { h: 'Data controller', ul: identity(s, l) },
            { h: 'What data we process and why', p: ['This website does not store personal data on its own servers. The quotation and contact forms and the cart prepare a message that you send via WhatsApp. Through that message we receive the data you choose to include (name, company, country, email, phone, product, volume and requirements), which we use only to answer your request and, where applicable, to manage the order, invoicing and shipping.'] },
            { h: 'Legal basis', p: ['Your consent when you send us the message and pre-contractual steps or performance of a contract (Art. 6(1)(a) and 6(1)(b) GDPR); legal invoicing obligations (Art. 6(1)(c) GDPR).'] },
            { h: 'Recipients', p: ['We do not share data with third parties unless legally required. Messages are transmitted through WhatsApp (Meta), which applies its own privacy policy.'] },
            { h: 'Retention', p: ['Request data are kept while a business relationship exists or, otherwise, for up to two years; order and invoicing data for the periods required by commercial and tax law.'] },
            { h: 'Your rights', p: [`You may exercise your rights of access, rectification, erasure, objection, restriction and portability ${rights}. You may also lodge a complaint with the Spanish Data Protection Agency (www.aepd.es).`] },
          ],
        };
  }

  if (key === 'cookies') {
    const rows = es
      ? [
          ['Nombre', 'Tipo', 'Finalidad', 'Duración'],
          ['morano_cart_v2', 'Almacenamiento local propio', 'Guardar los productos del carrito', 'Hasta que vacíe el carrito'],
          ['me_intro', 'Almacenamiento de sesión propio', 'Recordar que ya se mostró la animación de carga', 'Sesión'],
        ]
      : [
          ['Name', 'Type', 'Purpose', 'Duration'],
          ['morano_cart_v2', 'First-party local storage', 'Keep the products in your cart', 'Until you empty the cart'],
          ['me_intro', 'First-party session storage', 'Remember that the loading animation has been shown', 'Session'],
        ];
    return es
      ? {
          title: 'Política de cookies',
          blocks: [
            { h: 'Qué utilizamos', p: ['Este sitio no usa cookies. Solo guarda en su navegador, de forma técnica y necesaria, el contenido del carrito y si ya se mostró la animación inicial. No hay análisis, publicidad ni seguimiento, por lo que no se requiere consentimiento (art. 22.2 LSSI-CE).'], table: rows },
            { h: 'Servicios de terceros', p: ['Los botones de WhatsApp e Instagram abren esos servicios, que aplican sus propias políticas.'] },
            { h: 'Cómo eliminarlo', p: ['Puede borrar el almacenamiento local desde la configuración de su navegador. Si lo hace, se vaciará el carrito.'] },
          ],
        }
      : {
          title: 'Cookie policy',
          blocks: [
            { h: 'What we use', p: ['This website does not use cookies. It only stores, for technical and necessary purposes, your cart contents and whether the loading animation has been shown. There is no analytics, advertising or tracking, so consent is not required (Art. 22.2 LSSI-CE).'], table: rows },
            { h: 'Third-party services', p: ['The WhatsApp and Instagram buttons open those services, which apply their own policies.'] },
            { h: 'How to delete it', p: ['You can clear local storage in your browser settings. Doing so will empty your cart.'] },
          ],
        };
  }

  // Condiciones de compra
  const vat = es
    ? s.pricesIncludeVat
      ? `Los precios se muestran en euros e incluyen el IVA aplicable (${s.vatRateBp / 100} %).`
      : `Los precios se muestran en euros sin IVA; el IVA aplicable (${s.vatRateBp / 100} %) se añade al total.`
    : s.pricesIncludeVat
      ? `Prices are shown in euros and include applicable VAT (${s.vatRateBp / 100} %).`
      : `Prices are shown in euros excluding VAT; applicable VAT (${s.vatRateBp / 100} %) is added to the total.`;
  return es
    ? {
        title: 'Condiciones de compra',
        blocks: [
          { h: 'Vendedor', ul: identity(s, l) },
          { h: 'Ámbito', p: ['Estas condiciones regulan los pedidos de los productos de compra directa de este sitio (aceite crudo de palmiste, CPKO, y torta de palmiste, PKE, en sus distintas presentaciones). El resto de productos se suministran bajo cotización y acuerdo comercial específico.'] },
          { h: 'Precios', p: [vat, 'El total del carrito es una estimación: el importe final, con envío e impuestos, se confirma por escrito antes del pago.'] },
          { h: 'Pedido y pago', p: ['El pedido se envía por WhatsApp desde el carrito. El equipo comercial confirma disponibilidad, plazo de entrega, coste de envío y forma de pago (factura proforma). El contrato se perfecciona con esa confirmación y el pago acordado.'] },
          { h: 'Desistimiento', p: ['Si compra como consumidor, dispone de 14 días naturales desde la entrega para desistir sin indicar el motivo. Se exceptúan los productos precintados que no puedan devolverse por razones de protección de la salud o de higiene una vez desprecintados (art. 103 del Real Decreto Legislativo 1/2007). Las compras de empresas o profesionales para su actividad no tienen derecho de desistimiento.'] },
          { h: 'Garantía y reclamaciones', p: ['Para cualquier incidencia, contacte con nosotros por WhatsApp indicando los datos del pedido.'] },
          { h: 'Legislación aplicable', p: ['Estas condiciones se rigen por la legislación española, sin perjuicio de los derechos que la normativa de consumo reconozca al comprador consumidor.'] },
        ],
      }
    : {
        title: 'Terms of sale',
        blocks: [
          { h: 'Seller', ul: identity(s, l) },
          { h: 'Scope', p: ['These terms govern orders for the direct-purchase products on this website (crude palm kernel oil, CPKO, and palm kernel expeller, PKE, in their different pack sizes). All other products are supplied on quotation and under a specific commercial agreement.'] },
          { h: 'Prices', p: [vat, 'The cart total is an estimate: the final amount, including shipping and taxes, is confirmed in writing before payment.'] },
          { h: 'Ordering and payment', p: ['Orders are sent via WhatsApp from the cart. Our commercial team confirms availability, delivery time, shipping cost and payment method (proforma invoice). The contract is concluded upon that confirmation and the agreed payment.'] },
          { h: 'Right of withdrawal', p: ['If you buy as a consumer, you have 14 calendar days from delivery to withdraw without giving a reason. Sealed goods that are not suitable for return due to health protection or hygiene reasons once unsealed are excluded (Art. 103 of Spanish Royal Legislative Decree 1/2007). Purchases made by businesses or professionals for their activity carry no right of withdrawal.'] },
          { h: 'Warranty and complaints', p: ['For any issue, please contact us via WhatsApp quoting your order details.'] },
          { h: 'Governing law', p: ['These terms are governed by Spanish law, without prejudice to the rights granted to consumers by consumer protection law.'] },
        ],
      };
}

export const legalAlternates = (key: LegalKey) => ({ es: ROUTES[key].es, en: ROUTES[key].en });
