/** The pricing page's published Service is the source for listing plan metadata/copy. */
function subscriptionPlan(html) {
  const nodes = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(match => {
      const data = JSON.parse(match[1]);
      return data['@graph'] || [data];
    });
  const service = nodes.find(node => node['@type'] === 'Service' && node['@id'] === 'https://proappstore.online/pricing#subscription');
  const offer = service?.offers;
  const specification = offer?.priceSpecification;
  if (!offer || specification?.['@type'] !== 'UnitPriceSpecification' ||
      String(offer.price) !== String(specification.price) ||
      offer.priceCurrency !== specification.priceCurrency ||
      !specification.billingDuration || !specification.unitText || !Number.isFinite(Number(offer.price))) {
    throw new Error('Pricing page must declare one consistent recurring subscription Service');
  }
  const price = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: offer.priceCurrency,
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(Number(offer.price));
  const period = specification.unitText === 'month' ? 'mo' : specification.unitText;
  return { service, label: `${price}/${period} subscription` };
}

const jsonLd = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char =>
  `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

module.exports = { subscriptionPlan, jsonLd };
