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

const CATEGORY_ALIASES = new Map([
  ['makeup', 'Makeup'],
  ['maquillaje', 'Makeup'],
  ['cosmetics', 'Makeup'],
  ['skincare', 'Skincare'],
  ['skin care', 'Skincare'],
  ['cuidado de piel', 'Skincare'],
  ['cuidado facial', 'Skincare'],
  ['perfume', 'Perfumes de mujer'],
  ['perfumes', 'Perfumes de mujer'],
  ['women perfume', 'Perfumes de mujer'],
  ['womens perfume', 'Perfumes de mujer'],
  ["women's perfume", 'Perfumes de mujer'],
  ['fragrance', 'Perfumes de mujer'],
  ['fragancia', 'Perfumes de mujer'],
  ['perfumes de mujer', 'Perfumes de mujer'],
  ['bodycare', 'Bodycare'],
  ['body care', 'Bodycare'],
  ['cuidado corporal', 'Bodycare']
]);

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'eclatskinatelier-telegram-bot' });
    }

    if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
      return handleTelegramWebhook(request, env);
    }

    return json({ ok: false, error: 'Not found' }, 404);
  }
};

async function handleTelegramWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.OFFERS_KV) {
    return json({ ok: false, error: 'Worker is not configured' }, 500);
  }

  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET || '';
  const actualSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';

  if (expectedSecret && actualSecret !== expectedSecret) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const update = await request.json();
  const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);

  if (update.message) {
    await handleMessage(update.message, env, telegram);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query, env, telegram);
  }

  return json({ ok: true });
}

async function handleMessage(message, env, telegram) {
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || '');
  const isPrivateChat = message.chat.type === 'private';

  if (text.startsWith('/chatid')) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: [
        `Chat ID: ${chatId}`,
        `Your user ID: ${userId}`,
        '',
        'Use your user ID as TELEGRAM_ADMIN_CHAT_ID.',
        'Use the group Chat ID as TELEGRAM_GROUP_CHAT_ID.'
      ].join('\n')
    });
    return;
  }

  if (!isAuthorizedUser(userId, env)) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: 'Este bot es privado para revisar ofertas de EclatSkinAtelier.'
    });
    return;
  }

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: helpText(message, env),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    return;
  }

  if (text.startsWith('/rules')) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: offerUsageText(getRules(env)),
      disable_web_page_preview: true
    });
    return;
  }

  if (text.startsWith('/status')) {
    const counts = await countOffers(env);
    await telegram.sendMessage({
      chat_id: chatId,
      text: [
        'Estado del bot:',
        '',
        `Admin configurado: ${env.TELEGRAM_ADMIN_CHAT_ID ? 'si' : 'no'}`,
        `Grupo configurado: ${env.TELEGRAM_GROUP_CHAT_ID ? 'si' : 'no'}`,
        `Tag Amazon: ${getRules(env).amazonAssociateTag}`,
        `Ofertas totales: ${counts.total}`,
        `Pendientes: ${counts.pending || 0}`,
        `Publicadas: ${counts.published || 0}`,
        `Rechazadas: ${counts.rejected || 0}`
      ].join('\n')
    });
    return;
  }

  if (text.startsWith('/offer') || text.startsWith('/draft')) {
    if (!isPrivateChat) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: 'Mandame las ofertas por privado para que el grupo no vea borradores.'
      });
      return;
    }

    const { offer, errors, warnings } = parseOfferCommand(text, getRules(env));

    if (errors.length > 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: formatValidationErrors(errors),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      return;
    }

    const savedOffer = await createOffer(env, {
      ...offer,
      warnings,
      submittedBy: userId
    });

    await sendOfferReview(chatId, savedOffer, warnings, telegram);
    return;
  }

  await telegram.sendMessage({
    chat_id: chatId,
    text: 'No reconozco ese comando. Usa /help para ver el formato del MVP.'
  });
}

async function handleCallback(callback, env, telegram) {
  const userId = String(callback.from?.id || '');

  if (!isAuthorizedUser(userId, env)) {
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'No autorizado.',
      show_alert: true
    });
    return;
  }

  const [action, offerId] = String(callback.data || '').split(':');
  const offer = await getOffer(env, offerId);

  if (!offer) {
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'Oferta no encontrada.',
      show_alert: true
    });
    return;
  }

  if (action === 'reject') {
    const updated = await updateOffer(env, offer.id, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: userId
    });

    await editReviewMessage(callback.message, updated, 'Rechazada', telegram);
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'Oferta rechazada.'
    });
    return;
  }

  if (action === 'approve') {
    if (!env.TELEGRAM_GROUP_CHAT_ID) {
      await telegram.answerCallbackQuery({
        callback_query_id: callback.id,
        text: 'Falta TELEGRAM_GROUP_CHAT_ID.',
        show_alert: true
      });
      return;
    }

    if (offer.status === 'published') {
      await telegram.answerCallbackQuery({
        callback_query_id: callback.id,
        text: 'Esta oferta ya fue publicada.'
      });
      return;
    }

    let sentMessage;

    try {
      sentMessage = await sendPublicOffer(env.TELEGRAM_GROUP_CHAT_ID, offer, env, telegram);
    } catch (error) {
      await telegram.answerCallbackQuery({
        callback_query_id: callback.id,
        text: 'No pude publicar la oferta. Revisa que la imagen sea publica y valida.',
        show_alert: true
      });
      console.error(error.message);
      return;
    }

    const updated = await updateOffer(env, offer.id, {
      status: 'published',
      approvedAt: new Date().toISOString(),
      approvedBy: userId,
      telegramMessageId: sentMessage.message_id
    });

    await editReviewMessage(callback.message, updated, 'Publicada', telegram);
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'Oferta publicada en el grupo.'
    });
  }
}

async function createOffer(env, offer) {
  const savedOffer = {
    ...offer,
    id: `of_${Date.now().toString(36)}`,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  await env.OFFERS_KV.put(offerKey(savedOffer.id), JSON.stringify(savedOffer));
  return savedOffer;
}

async function getOffer(env, id) {
  if (!id) {
    return null;
  }

  const value = await env.OFFERS_KV.get(offerKey(id), 'json');
  return value || null;
}

async function updateOffer(env, id, patch) {
  const existing = await getOffer(env, id);

  if (!existing) {
    return null;
  }

  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await env.OFFERS_KV.put(offerKey(id), JSON.stringify(updated));
  return updated;
}

async function countOffers(env) {
  const counts = { total: 0 };
  let cursor;

  do {
    const result = await env.OFFERS_KV.list({ prefix: 'offer:', cursor });
    cursor = result.cursor;

    for (const key of result.keys) {
      const offer = await env.OFFERS_KV.get(key.name, 'json');

      if (!offer) {
        continue;
      }

      counts.total += 1;
      counts[offer.status] = (counts[offer.status] || 0) + 1;
    }
  } while (cursor);

  return counts;
}

function offerKey(id) {
  return `offer:${id}`;
}

async function sendOfferReview(chatId, offer, warnings, telegram) {
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: 'Aprobar', callback_data: `approve:${offer.id}` },
        { text: 'Rechazar', callback_data: `reject:${offer.id}` }
      ]
    ]
  };

  const caption = formatReviewCaption(offer, warnings);
  await sendOfferMessage(chatId, offer, caption, replyMarkup, {}, telegram);
}

async function sendPublicOffer(chatId, offer, env, telegram) {
  const caption = formatPublicCaption(offer, env.POST_LANGUAGE || 'en');
  return sendOfferMessage(chatId, offer, caption, undefined, { requirePhoto: true }, telegram);
}

async function sendOfferMessage(chatId, offer, caption, replyMarkup, options, telegram) {
  const basePayload = {
    chat_id: chatId,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
    disable_web_page_preview: false
  };

  if (offer.imageUrl) {
    try {
      return await telegram.sendPhoto({
        ...basePayload,
        photo: offer.imageUrl,
        caption
      });
    } catch (error) {
      if (options.requirePhoto) {
        throw error;
      }
    }
  }

  if (options.requirePhoto) {
    throw new Error(`Offer ${offer.id || 'draft'} has no publishable image URL.`);
  }

  return telegram.sendMessage({
    ...basePayload,
    text: caption
  });
}

async function editReviewMessage(message, offer, status, telegram) {
  const caption = formatReviewCaption(offer, offer.warnings || [], status);
  const basePayload = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [] }
  };

  if (message.photo) {
    await telegram.editMessageCaption({
      ...basePayload,
      caption
    });
    return;
  }

  await telegram.editMessageText({
    ...basePayload,
    text: caption,
    disable_web_page_preview: true
  });
}

class TelegramClient {
  constructor(token) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call(method, payload = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      const message = result?.description || response.statusText || 'Unknown Telegram API error';
      throw new Error(`${method} failed: ${message}`);
    }

    return result.result;
  }

  sendMessage(payload) {
    return this.call('sendMessage', payload);
  }

  sendPhoto(payload) {
    return this.call('sendPhoto', payload);
  }

  editMessageText(payload) {
    return this.call('editMessageText', payload);
  }

  editMessageCaption(payload) {
    return this.call('editMessageCaption', payload);
  }

  answerCallbackQuery(payload) {
    return this.call('answerCallbackQuery', payload);
  }
}

function parseOfferCommand(text, rules) {
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

function formatPublicCaption(offer, language = 'en') {
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

  return trimTelegramCaption((templates[language] || templates.en).join('\n'));
}

function formatReviewCaption(offer, warnings = [], status = 'Pendiente') {
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

function formatValidationErrors(errors) {
  return [
    'La oferta no paso las reglas del MVP:',
    '',
    ...errors.map((error) => `- ${escapeHtml(error)}`),
    '',
    'Usa /help para ver el formato correcto.'
  ].join('\n');
}

function offerUsageText(rules) {
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

function helpText(message, env) {
  const userId = String(message.from?.id || '');
  const chatId = String(message.chat.id);

  return [
    'Bot de aprobacion de ofertas para EclatSkinAtelier.',
    '',
    `Tu user ID: <code>${escapeHtml(userId)}</code>`,
    `Este chat ID: <code>${escapeHtml(chatId)}</code>`,
    '',
    offerUsageText(getRules(env)),
    '',
    'Comandos:',
    '/offer - Crear una oferta pendiente',
    '/rules - Ver reglas del filtro',
    '/status - Ver estado del bot',
    '/chatid - Ver IDs para configurar Telegram'
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
      url: sourceUrl,
      sourceUrl,
      asin: '',
      warning: 'Short amzn.to link accepted. Confirm it resolves to the right Amazon product before approval.'
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

function getRules(env) {
  return {
    amazonAssociateTag: env.AMAZON_ASSOCIATE_TAG || 'luxeskinateli-20',
    minDiscountPercent: numberValue(env.MIN_DISCOUNT_PERCENT, 5),
    minReviewCount: numberValue(env.MIN_REVIEW_COUNT, 1000),
    minRating: numberValue(env.MIN_RATING, 4)
  };
}

function isAuthorizedUser(userId, env) {
  if (!env.TELEGRAM_ADMIN_CHAT_ID) {
    return true;
  }

  return String(userId) === String(env.TELEGRAM_ADMIN_CHAT_ID);
}

function normalizeKey(key) {
  return FIELD_ALIASES.get(cleanKey(key)) || null;
}

function normalizeCategory(category) {
  return CATEGORY_ALIASES.get(cleanKey(category)) || null;
}

function allowedCategories() {
  return [...new Set(CATEGORY_ALIASES.values())];
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

function numberValue(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return MONEY_FORMATTER.format(value);
}

function formatReviewCount(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US').format(value);
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}
