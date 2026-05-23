import { categoryAliases } from './config.mjs';

const REQUIRED_FIELDS = ['title', 'url', 'image', 'before', 'after', 'rating', 'reviews', 'category'];

const FIELD_ALIASES = new Map([
  ['title', 'title'],
  ['titulo', 'title'],
  ['producto', 'title'],
  ['product', 'title'],
  ['name', 'title'],
  ['url', 'url'],
  ['link', 'url'],
  ['enlace', 'url'],
  ['before', 'before'],
  ['antes', 'before'],
  ['was', 'before'],
  ['list', 'before'],
  ['after', 'after'],
  ['despues', 'after'],
  ['ahora', 'after'],
  ['now', 'after'],
  ['price', 'after'],
  ['rating', 'rating'],
  ['calificacion', 'rating'],
  ['reviews', 'reviews'],
  ['reviewers', 'reviews'],
  ['resenas', 'reviews'],
  ['reseñas', 'reviews'],
  ['category', 'category'],
  ['categoria', 'category'],
  ['nicho', 'category'],
  ['image', 'image'],
  ['imagen', 'image'],
  ['photo', 'image'],
  ['foto', 'image']
]);

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

export function parseOfferCommand(text, rules) {
  const body = text.replace(/^\/(?:offer|draft)(?:@\w+)?\s*/i, '').trim();

  if (!body) {
    return {
      offer: null,
      errors: ['Missing offer details.'],
      warnings: []
    };
  }

  const rawFields = body.includes('=')
    ? parseKeyValueBody(body)
    : parsePipeBody(body);

  const errors = [];
  const warnings = [];

  for (const field of REQUIRED_FIELDS) {
    if (!rawFields[field]) {
      errors.push(`Missing field: ${field}`);
    }
  }

  const beforePrice = parseMoney(rawFields.before);
  const afterPrice = parseMoney(rawFields.after);
  const rating = parseDecimal(rawFields.rating);
  const reviewCount = parseInteger(rawFields.reviews);
  const category = normalizeCategory(rawFields.category);
  const urlResult = buildAffiliateUrl(rawFields.url, rules.amazonAssociateTag);
  const imageUrl = cleanOptionalUrl(rawFields.image);

  if (!Number.isFinite(beforePrice) || beforePrice <= 0) {
    errors.push('Before price must be a positive number.');
  }

  if (!Number.isFinite(afterPrice) || afterPrice <= 0) {
    errors.push('After price must be a positive number.');
  }

  if (Number.isFinite(beforePrice) && Number.isFinite(afterPrice) && afterPrice >= beforePrice) {
    errors.push('After price must be lower than before price.');
  }

  if (!Number.isFinite(rating)) {
    errors.push('Rating must be a number.');
  }

  if (!Number.isFinite(reviewCount)) {
    errors.push('Reviews must be a number.');
  }

  if (!category) {
    errors.push(`Category must be one of: ${allowedCategories().join(', ')}`);
  }

  if (!urlResult.url) {
    errors.push('URL must be a valid Amazon.com product URL.');
  }

  if (urlResult.warning) {
    warnings.push(urlResult.warning);
  }

  if (!imageUrl) {
    errors.push('Image must be a valid public image URL.');
  }

  const discountPercent = calculateDiscountPercent(beforePrice, afterPrice);

  if (Number.isFinite(discountPercent) && discountPercent < rules.minDiscountPercent) {
    errors.push(`Discount must be at least ${rules.minDiscountPercent}%.`);
  }

  if (Number.isFinite(rating) && rating < rules.minRating) {
    errors.push(`Rating must be at least ${rules.minRating}.`);
  }

  if (Number.isFinite(reviewCount) && reviewCount < rules.minReviewCount) {
    errors.push(`Reviews must be at least ${rules.minReviewCount}.`);
  }

  const offer = {
    title: cleanText(rawFields.title),
    category,
    originalCategory: cleanText(rawFields.category),
    beforePrice,
    afterPrice,
    discountPercent,
    rating,
    reviewCount,
    sourceUrl: urlResult.sourceUrl || cleanText(rawFields.url),
    affiliateUrl: urlResult.url,
    asin: urlResult.asin,
    imageUrl
  };

  return { offer, errors, warnings };
}

export function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return MONEY_FORMATTER.format(value);
}

export function formatReviewCount(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPublicCaption(offer, language = 'es') {
  const title = escapeHtml(offer.title);
  const link = escapeHtml(offer.affiliateUrl);

  const templates = {
    en: [
      '<b>Beauty Deal</b>',
      '',
      `<b>${title}</b>`,
      '',
      `Was: <s>${formatMoney(offer.beforePrice)}</s>`,
      `Now: <b>${formatMoney(offer.afterPrice)}</b>`,
      `Save: <b>${offer.discountPercent}%</b>`,
      '',
      `<a href="${link}">Shop the deal on Amazon</a>`
    ],
    es: [
      'Oferta beauty',
      '',
      `<b>${title}</b>`,
      '',
      `Antes: <s>${formatMoney(offer.beforePrice)}</s>`,
      `Ahora: <b>${formatMoney(offer.afterPrice)}</b>`,
      `Ahorro: <b>${offer.discountPercent}%</b>`,
      '',
      `<a href="${link}">Ver oferta en Amazon</a>`
    ]
  };

  return trimTelegramCaption((templates[language] || templates.es).join('\n'));
}

export function formatReviewCaption(offer, warnings = [], status = 'Pendiente') {
  const warningBlock = warnings.length
    ? `\n\nAvisos:\n${warnings.map((warning) => `- ${escapeHtml(warning)}`).join('\n')}`
    : '';

  return trimTelegramCaption([
    `Revision de oferta: <b>${escapeHtml(status)}</b>`,
    '',
    `<b>${escapeHtml(offer.title)}</b>`,
    '',
    `Categoria: ${escapeHtml(offer.category || 'n/a')}`,
    `Antes: ${formatMoney(offer.beforePrice)}`,
    `Ahora: ${formatMoney(offer.afterPrice)}`,
    `Ahorro: ${offer.discountPercent}%`,
    `Rating: ${offer.rating}`,
    `Reviews: ${formatReviewCount(offer.reviewCount)}`,
    offer.asin ? `ASIN: ${escapeHtml(offer.asin)}` : null,
    '',
    `<a href="${escapeHtml(offer.affiliateUrl)}">Abrir link afiliado</a>`,
    warningBlock
  ].filter(Boolean).join('\n'));
}

export function formatValidationErrors(errors) {
  return [
    'La oferta no paso las reglas del MVP:',
    '',
    ...errors.map((error) => `- ${escapeHtml(error)}`),
    '',
    'Usa /help para ver el formato correcto.'
  ].join('\n');
}

export function offerUsageText(rules) {
  return [
    'Formato para crear una oferta pendiente:',
    '',
    '/offer',
    'title=Maybelline Lash Sensational Sky High Mascara',
    'url=https://www.amazon.com/dp/B08H4FSGDW',
    'image=https://m.media-amazon.com/images/I/example.jpg',
    'before=14.99',
    'after=10.99',
    'rating=4.5',
    'reviews=85000',
    'category=makeup',
    '',
    'Reglas actuales:',
    `- Descuento minimo: ${rules.minDiscountPercent}%`,
    `- Reviews minimos: ${rules.minReviewCount}`,
    `- Rating minimo: ${rules.minRating}`,
    '- Imagen requerida: si',
    `- Categorias: ${allowedCategories().join(', ')}`
  ].join('\n');
}

function parseKeyValueBody(body) {
  const fields = {};

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizeKey(line.slice(0, separatorIndex));
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      fields[key] = value;
    }
  }

  return fields;
}

function parsePipeBody(body) {
  const [title, before, after, rating, reviews, category, url, image] = body
    .split('|')
    .map((part) => part.trim());

  return {
    title,
    before,
    after,
    rating,
    reviews,
    category,
    url,
    image
  };
}

function normalizeKey(key) {
  return FIELD_ALIASES.get(cleanKey(key)) || null;
}

function normalizeCategory(category) {
  return categoryAliases.get(cleanKey(category)) || null;
}

function allowedCategories() {
  return [...new Set(categoryAliases.values())];
}

function cleanKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function cleanText(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

function parseMoney(value) {
  const cleaned = String(value || '')
    .replace(/[$,\s]/g, '')
    .replace(/[^\d.]/g, '');

  return Number.parseFloat(cleaned);
}

function parseDecimal(value) {
  return Number.parseFloat(String(value || '').replace(',', '.').replace(/[^\d.]/g, ''));
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function cleanOptionalUrl(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return '';
  }

  try {
    return normalizeUrl(cleaned).toString();
  } catch {
    return '';
  }
}

function buildAffiliateUrl(rawUrl, associateTag) {
  const sourceUrl = cleanText(rawUrl);

  if (!sourceUrl) {
    return { url: '', sourceUrl, asin: '', warning: '' };
  }

  let parsed;

  try {
    parsed = normalizeUrl(sourceUrl);
  } catch {
    return { url: '', sourceUrl, asin: '', warning: '' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'amzn.to') {
    return {
      url: '',
      sourceUrl,
      asin: '',
      warning: 'Short amzn.to links are not accepted in the MVP. Use the full amazon.com product URL.'
    };
  }

  if (!host.endsWith('amazon.com')) {
    return {
      url: '',
      sourceUrl,
      asin: '',
      warning: 'For the US affiliate tag, use amazon.com product URLs.'
    };
  }

  const asin = extractAsin(parsed);

  if (asin) {
    return {
      url: `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(associateTag)}`,
      sourceUrl,
      asin,
      warning: ''
    };
  }

  parsed.searchParams.set('tag', associateTag);

  return {
    url: parsed.toString(),
    sourceUrl,
    asin: '',
    warning: 'No ASIN was detected, so the MVP kept the original URL and only added the affiliate tag.'
  };
}

function normalizeUrl(value) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

function extractAsin(url) {
  const pathMatch = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)?/i);

  if (pathMatch) {
    return pathMatch[1].toUpperCase();
  }

  const asinParam = url.searchParams.get('asin') || url.searchParams.get('ASIN');
  return /^[A-Z0-9]{10}$/i.test(asinParam || '') ? asinParam.toUpperCase() : '';
}

function calculateDiscountPercent(beforePrice, afterPrice) {
  if (!Number.isFinite(beforePrice) || !Number.isFinite(afterPrice) || beforePrice <= 0) {
    return Number.NaN;
  }

  return Math.round(((beforePrice - afterPrice) / beforePrice) * 100);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trimTelegramCaption(value) {
  if (value.length <= 1000) {
    return value;
  }

  return `${value.slice(0, 997)}...`;
}
