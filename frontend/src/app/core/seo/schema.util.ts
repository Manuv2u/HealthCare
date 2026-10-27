import { ORG_INFO } from './organization.data';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    name: ORG_INFO.name,
    alternateName: ORG_INFO.alternateName,
    url: ORG_INFO.url,
    logo: ORG_INFO.logo,
    image: ORG_INFO.logo,
    telephone: ORG_INFO.telephone,
    email: ORG_INFO.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ORG_INFO.streetAddress,
      addressLocality: ORG_INFO.addressLocality,
      addressRegion: ORG_INFO.addressRegion,
      postalCode: ORG_INFO.postalCode,
      addressCountry: ORG_INFO.addressCountry,
    },
    sameAs: ORG_INFO.sameAs,
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${ORG_INFO.url}${item.path}`,
    })),
  };
}

export function buildFaqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildItemListSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: `${ORG_INFO.url}${item.path}`,
    })),
  };
}
