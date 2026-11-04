// Datos de contacto oficiales y URL pública del sitio.
export const config = {
  siteUrl: 'https://www.moranoeurope.com',
};

export const contact = {
  company: 'MORANO EUROPE SL',
  brand: 'Morano Europe',
  address: 'Paseo de la Castellana 200, Madrid, España',
  addressShort: 'Paseo de la Castellana 200, Madrid',
  whatsapp: '+34 691 777 292',
  whatsappDigits: '34691777292',
  instagram: 'moranoeurope',
  instagramUrl: 'https://www.instagram.com/moranoeurope/',
  web: 'www.moranoeurope.com',
  groupUrl: 'https://moranogruppo.com/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Paseo+de+la+Castellana+200+Madrid',
};

export const whatsappUrl = (text: string) => `https://wa.me/${contact.whatsappDigits}?text=${encodeURIComponent(text)}`;
