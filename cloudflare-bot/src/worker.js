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
  ['affiliateurl', 'url'],
  ['detailpageurl', 'url'],
  ['before', 'before'],
  ['antes', 'before'],
  ['was', 'before'],
  ['list', 'before'],
  ['beforeprice', 'before'],
  ['wasprice', 'before'],
  ['listprice', 'before'],
  ['originalprice', 'before'],
  ['after', 'after'],
  ['despues', 'after'],
  ['ahora', 'after'],
  ['now', 'after'],
  ['price', 'after'],
  ['afterprice', 'after'],
  ['saleprice', 'after'],
  ['currentprice', 'after'],
  ['dealprice', 'after'],
  ['rating', 'rating'],
  ['calificacion', 'rating'],
  ['customerrating', 'rating'],
  ['averagerating', 'rating'],
  ['stars', 'rating'],
  ['reviews', 'reviews'],
  ['reviewers', 'reviews'],
  ['resenas', 'reviews'],
  ['reviewcount', 'reviews'],
  ['reviewercount', 'reviews'],
  ['ratingscount', 'reviews'],
  ['totalreviews', 'reviews'],
  ['reseñas', 'reviews'],
  ['category', 'category'],
  ['categoria', 'category'],
  ['nicho', 'category'],
  ['department', 'category'],
  ['productgroup', 'category'],
  ['image', 'image'],
  ['imagen', 'image'],
  ['photo', 'image'],
  ['foto', 'image'],
  ['imageurl', 'image'],
  ['primaryimage', 'image']
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

const SCAN_STATE_KEY = 'scanner:last-run';
const SCAN_DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SCAN_LIMIT = 5;
const MAX_SCAN_LIMIT = 20;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'eclatskinatelier-telegram-bot' });
    }

    if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
      return handleTelegramWebhook(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/scanner/run') {
      return handleScannerRun(request, env);
    }

    return json({ ok: false, error: 'Not found' }, 404);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledScan(controller, env));
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

async function handleScannerRun(request, env) {
  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET || '';
  const actualSecret = request.headers.get('X-Scanner-Secret') || '';

  if (expectedSecret && actualSecret !== expectedSecret) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const telegram = env.TELEGRAM_BOT_TOKEN ? new TelegramClient(env.TELEGRAM_BOT_TOKEN) : null;
  const result = await runDealScan(env, telegram, { trigger: 'http' });
  return json({ ok: result.status !== 'error', result });
}

async function runScheduledScan(controller, env) {
  if (!isScannerEnabled(env)) {
    return;
  }

  const telegram = env.TELEGRAM_BOT_TOKEN ? new TelegramClient(env.TELEGRAM_BOT_TOKEN) : null;

  try {
    await runDealScan(env, telegram, {
      trigger: 'cron',
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString()
    });
  } catch (error) {
    console.error(`Scheduled scan failed: ${error.message}`);
  }
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
    const scannerConfig = getScannerConfig(env);
    const scanStatus = await getScanStatus(env);
    await telegram.sendMessage({
      chat_id: chatId,
      text: [
        'Estado del bot:',
        '',
        `Admin configurado: ${env.TELEGRAM_ADMIN_CHAT_ID ? 'si' : 'no'}`,
        `Grupo configurado: ${env.TELEGRAM_GROUP_CHAT_ID ? 'si' : 'no'}`,
        `Tag Amazon: ${getRules(env).amazonAssociateTag}`,
        `Scanner programado: ${scannerConfig.enabled ? 'si' : 'no'}`,
        `Fuente de ofertas: ${scannerConfig.feedUrl ? 'configurada' : 'pendiente'}`,
        `Ultimo scan: ${formatLastScan(scanStatus)}`,
        `Ofertas totales: ${counts.total}`,
        `Pendientes: ${counts.pending || 0}`,
        `Publicadas: ${counts.published || 0}`,
        `Rechazadas: ${counts.rejected || 0}`
      ].join('\n')
    });
    return;
  }

  if (text.startsWith('/scan')) {
    const limit = parseScanLimit(text);
    const result = await runDealScan(env, telegram, {
      trigger: 'manual',
      requestedBy: userId,
      replyChatId: chatId,
      limit
    });

    await telegram.sendMessage({
      chat_id: chatId,
      text: formatScanSummary(result),
      parse_mode: 'HTML',
      disable_web_page_preview: true
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

async function runDealScan(env, telegram, options = {}) {
  const config = getScannerConfig(env, options);
  const result = {
    status: 'ok',
    trigger: options.trigger || 'manual',
    startedAt: new Date().toISOString(),
    sourceConfigured: Boolean(config.feedUrl),
    checked: 0,
    processed: 0,
    queued: 0,
    duplicates: 0,
    invalid: 0,
    notifyErrors: 0,
    invalidExamples: [],
    errors: []
  };

  if (!env.OFFERS_KV) {
    return {
      ...result,
      status: 'error',
      message: 'OFFERS_KV is not configured.'
    };
  }

  if (!telegram) {
    await saveScanStatus(env, {
      ...result,
      status: 'error',
      message: 'TELEGRAM_BOT_TOKEN is not configured.',
      completedAt: new Date().toISOString()
    });
    return {
      ...result,
      status: 'error',
      message: 'TELEGRAM_BOT_TOKEN is not configured.'
    };
  }

  if (!config.adminChatId) {
    await saveScanStatus(env, {
      ...result,
      status: 'error',
      message: 'TELEGRAM_ADMIN_CHAT_ID is not configured.',
      completedAt: new Date().toISOString()
    });
    return {
      ...result,
      status: 'error',
      message: 'TELEGRAM_ADMIN_CHAT_ID is not configured.'
    };
  }

  if (!config.feedUrl) {
    const missingSource = {
      ...result,
      status: 'missing_source',
      message: 'Scanner is installed, but DEAL_FEED_URL is not configured yet.',
      completedAt: new Date().toISOString()
    };
    await saveScanStatus(env, missingSource);
    return missingSource;
  }

  let candidates;

  try {
    candidates = await fetchDealFeed(config);
  } catch (error) {
    const failed = {
      ...result,
      status: 'error',
      message: `Deal feed failed: ${error.message}`,
      completedAt: new Date().toISOString()
    };
    await saveScanStatus(env, failed);
    return failed;
  }

  result.checked = candidates.length;

  for (const candidate of candidates.slice(0, config.limit)) {
    result.processed += 1;

    const normalized = normalizeFeedCandidate(candidate);
    const { offer, errors, warnings } = validateOfferFields(normalized.fields, getRules(env));

    if (errors.length > 0) {
      result.invalid += 1;

      if (result.invalidExamples.length < 3) {
        result.invalidExamples.push({
          title: cleanText(normalized.fields.title || 'Untitled candidate'),
          errors
        });
      }

      continue;
    }

    const dedupKey = await buildScanDedupKey(offer);
    const existingOfferId = await env.OFFERS_KV.get(dedupKey);

    if (existingOfferId) {
      result.duplicates += 1;
      continue;
    }

    const sourceWarnings = normalized.sourceName
      ? [`Scanned from ${normalized.sourceName}. Review price and availability before approval.`]
      : ['Scanned candidate. Review price and availability before approval.'];

    const savedOffer = await createOffer(env, {
      ...offer,
      warnings: [...warnings, ...sourceWarnings],
      submittedBy: 'scanner',
      scanSource: normalized.sourceName || config.feedLabel,
      foundAt: normalized.foundAt
    });

    await env.OFFERS_KV.put(dedupKey, savedOffer.id, {
      expirationTtl: SCAN_DEDUP_TTL_SECONDS
    });

    try {
      await sendOfferReview(config.adminChatId, savedOffer, savedOffer.warnings, telegram);
      result.queued += 1;
    } catch (error) {
      result.notifyErrors += 1;
      result.errors.push(`Could not send preview for ${savedOffer.id}: ${error.message}`);
    }
  }

  const completed = {
    ...result,
    completedAt: new Date().toISOString()
  };
  await saveScanStatus(env, completed);
  return completed;
}

async function fetchDealFeed(config) {
  const headers = {
    accept: 'application/json'
  };

  if (config.feedBearerToken) {
    headers.authorization = `Bearer ${config.feedBearerToken}`;
  }

  const response = await fetch(config.feedUrl, { headers });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const candidates = extractCandidateArray(payload);

  if (!Array.isArray(candidates)) {
    throw new Error('Feed response must be an array or contain offers/items/deals/data.');
  }

  return candidates;
}

function extractCandidateArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload.offers || payload.items || payload.deals || payload.data || payload.results || null;
}

function normalizeFeedCandidate(candidate = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const flatFields = {};

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = normalizeKey(key);

    if (normalizedKey && !isPresent(flatFields[normalizedKey]) && isPresent(value)) {
      flatFields[normalizedKey] = primitiveValue(value);
    }
  }

  const itemInfo = source.ItemInfo || source.itemInfo || {};
  const images = source.Images || source.images || {};
  const offers = source.Offers || source.offers || {};
  const listing = firstPresent(offers.Listings?.[0], offers.listings?.[0], source.listing, {});
  const price = listing.Price || listing.price || source.Price || source.priceInfo || {};
  const savings = price.Savings || price.savings || {};
  const savingBasis = listing.SavingBasis || listing.savingBasis || price.SavingBasis || price.savingBasis || {};
  const computedBefore = sumMoney(price.Amount, savings.Amount);

  const fields = {
    title: firstPresent(
      flatFields.title,
      source.title,
      source.name,
      itemInfo.Title?.DisplayValue,
      itemInfo.title?.displayValue
    ),
    url: firstPresent(
      flatFields.url,
      source.url,
      source.affiliateUrl,
      source.detailPageUrl,
      source.DetailPageURL,
      source.link
    ),
    image: imageValue(firstPresent(
      flatFields.image,
      source.image,
      source.imageUrl,
      source.image_url,
      source.primaryImage,
      images.Primary?.Large?.URL,
      images.Primary?.Medium?.URL,
      images.primary?.large?.url,
      images.primary?.medium?.url
    )),
    before: firstPresent(
      flatFields.before,
      source.beforePrice,
      source.wasPrice,
      source.listPrice,
      source.originalPrice,
      savingBasis.Amount,
      savingBasis.amount,
      computedBefore
    ),
    after: firstPresent(
      flatFields.after,
      source.afterPrice,
      source.salePrice,
      source.currentPrice,
      source.dealPrice,
      price.Amount,
      price.amount
    ),
    rating: firstPresent(
      flatFields.rating,
      source.rating,
      source.customerRating,
      source.averageRating,
      source.stars
    ),
    reviews: firstPresent(
      flatFields.reviews,
      source.reviews,
      source.reviewCount,
      source.reviewerCount,
      source.ratingsCount,
      source.totalReviews
    ),
    category: firstPresent(
      flatFields.category,
      source.category,
      source.niche,
      source.department,
      source.productGroup
    )
  };

  return {
    fields,
    sourceName: cleanText(firstPresent(source.source, source.sourceName, source.provider, 'deal feed')),
    foundAt: cleanText(firstPresent(source.foundAt, source.updatedAt, source.createdAt, new Date().toISOString()))
  };
}

async function buildScanDedupKey(offer) {
  const basis = offer.asin || offer.affiliateUrl || offer.sourceUrl || `${offer.title}:${offer.afterPrice}`;
  return `scan:${await hashText(basis)}`;
}

async function hashText(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

async function saveScanStatus(env, status) {
  if (!env.OFFERS_KV) {
    return;
  }

  await env.OFFERS_KV.put(SCAN_STATE_KEY, JSON.stringify(status), {
    expirationTtl: 14 * 24 * 60 * 60
  });
}

async function getScanStatus(env) {
  if (!env.OFFERS_KV) {
    return null;
  }

  return env.OFFERS_KV.get(SCAN_STATE_KEY, 'json');
}

function getScannerConfig(env, options = {}) {
  const limit = clampInteger(
    options.limit || env.MAX_SCAN_CANDIDATES || DEFAULT_SCAN_LIMIT,
    1,
    MAX_SCAN_LIMIT
  );
  const feedUrl = cleanText(env.DEAL_FEED_URL || env.SCANNER_FEED_URL || '');

  return {
    enabled: isScannerEnabled(env),
    feedUrl,
    feedLabel: feedUrl ? hostnameFromUrl(feedUrl) : 'deal feed',
    feedBearerToken: cleanText(env.DEAL_FEED_BEARER_TOKEN || ''),
    adminChatId: String(env.TELEGRAM_ADMIN_CHAT_ID || options.replyChatId || ''),
    limit
  };
}

function isScannerEnabled(env) {
  return cleanKey(env.SCAN_ENABLED || 'false') === 'true';
}

function parseScanLimit(text) {
  const match = text.match(/^\/scan(?:@\w+)?(?:\s+(\d{1,2}))?/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
}

function formatScanSummary(result) {
  if (result.status === 'missing_source') {
    return [
      '<b>Scanner de ofertas instalado</b>',
      '',
      'Falta conectar la fuente real de ofertas: <code>DEAL_FEED_URL</code>.',
      'Ese feed debe venir de Amazon Creators API/PA API o de una fuente autorizada y devolver precio, imagen, rating, reviews, categoria y link.',
      '',
      'Cuando lo conectemos, el bot te mandara cada candidato para aprobar o rechazar antes de publicarlo.'
    ].join('\n');
  }

  if (result.status === 'error') {
    return [
      '<b>Scanner de ofertas</b>',
      '',
      `Error: ${escapeHtml(result.message || 'unknown error')}`
    ].join('\n');
  }

  return [
    '<b>Scanner de ofertas</b>',
    '',
    `Revisadas: ${result.checked}`,
    `Procesadas: ${result.processed}`,
    `Nuevas para aprobar: ${result.queued}`,
    `Duplicadas: ${result.duplicates}`,
    `Fuera de reglas: ${result.invalid}`,
    result.notifyErrors ? `Errores al mandar preview: ${result.notifyErrors}` : null,
    '',
    result.queued
      ? 'Te mande las nuevas ofertas por privado con botones de aprobar/rechazar.'
      : 'No encontre ofertas nuevas que pasen el filtro en este scan.'
  ].filter(Boolean).join('\n');
}

function formatLastScan(scanStatus) {
  if (!scanStatus) {
    return 'n/a';
  }

  const when = scanStatus.completedAt || scanStatus.startedAt || 'n/a';
  const queued = Number.isFinite(scanStatus.queued) ? scanStatus.queued : 0;
  return `${when} (${scanStatus.status}, ${queued} nuevas)`;
}

function firstPresent(...values) {
  return values.find((value) => isPresent(value));
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function primitiveValue(value) {
  if (Array.isArray(value)) {
    return primitiveValue(value[0]);
  }

  if (value && typeof value === 'object') {
    return firstPresent(value.url, value.URL, value.href, value.DisplayValue, value.displayValue, value.Amount, value.amount);
  }

  return value;
}

function imageValue(value) {
  if (Array.isArray(value)) {
    return imageValue(value[0]);
  }

  if (value && typeof value === 'object') {
    return firstPresent(value.url, value.URL, value.src, value.href);
  }

  return value;
}

function sumMoney(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return undefined;
  }

  return leftNumber + rightNumber;
}

function clampInteger(value, min, max) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(max, Math.max(min, parsed));
}

function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return 'deal feed';
  }
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

  return validateOfferFields(rawFields, rules);
}

function validateOfferFields(rawFields, rules) {
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
    offer.scanSource ? `Fuente: ${escapeHtml(offer.scanSource)}` : null,
    offer.foundAt ? `Detectada: ${escapeHtml(offer.foundAt)}` : null,
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
    '/scan - Buscar ofertas nuevas y mandarlas a aprobacion',
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
