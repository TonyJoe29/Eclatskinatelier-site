import { setDefaultResultOrder } from 'node:dns';

import { adminIsConfigured, config, isAuthorizedUser, validateStartupConfig } from './config.mjs';
import { OfferStore } from './store.mjs';
import { TelegramClient } from './telegram-client.mjs';
import {
  formatPublicCaption,
  formatReviewCaption,
  formatValidationErrors,
  offerUsageText,
  parseOfferCommand
} from './offer-parser.mjs';

const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 3000;

setDefaultResultOrder('ipv4first');
validateStartupConfig();

const telegram = new TelegramClient(config.telegramBotToken);
const store = new OfferStore(config.dataFile);

let updateOffset = 0;

console.log('EclatSkinAtelier Telegram bot started.');
console.log(`Offer store: ${config.dataFile}`);

if (!adminIsConfigured()) {
  console.log('TELEGRAM_ADMIN_CHAT_ID is not configured. Send /start to the bot to discover your user ID.');
}

if (!config.groupChatId) {
  console.log('TELEGRAM_GROUP_CHAT_ID is not configured yet. Approvals will not publish until it is set.');
}

process.on('SIGINT', () => {
  console.log('\nStopping bot.');
  process.exit(0);
});

while (true) {
  try {
    const updates = await telegram.getUpdates({
      offset: updateOffset,
      timeout: POLL_TIMEOUT_SECONDS,
      allowed_updates: ['message', 'callback_query']
    });

    for (const update of updates) {
      updateOffset = update.update_id + 1;
      await handleUpdate(update);
    }
  } catch (error) {
    console.error(error.message);
    await delay(RETRY_DELAY_MS);
  }
}

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
    return;
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

async function handleMessage(message) {
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

  if (!isAuthorizedUser(userId)) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: 'Este bot es privado para revisar ofertas de EclatSkinAtelier.'
    });
    return;
  }

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: helpText(message),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    return;
  }

  if (text.startsWith('/rules')) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: offerUsageText(config),
      disable_web_page_preview: true
    });
    return;
  }

  if (text.startsWith('/status')) {
    const counts = await store.countByStatus();
    await telegram.sendMessage({
      chat_id: chatId,
      text: [
        'Estado del bot:',
        '',
        `Admin configurado: ${adminIsConfigured() ? 'si' : 'no'}`,
        `Grupo configurado: ${config.groupChatId ? 'si' : 'no'}`,
        `Tag Amazon: ${config.amazonAssociateTag}`,
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

    const { offer, errors, warnings } = parseOfferCommand(text, config);

    if (errors.length > 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: formatValidationErrors(errors),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      return;
    }

    const savedOffer = await store.create({
      ...offer,
      warnings,
      submittedBy: userId
    });

    await sendOfferReview(chatId, savedOffer, warnings);
    return;
  }

  await telegram.sendMessage({
    chat_id: chatId,
    text: 'No reconozco ese comando. Usa /help para ver el formato del MVP.'
  });
}

async function handleCallback(callback) {
  const userId = String(callback.from?.id || '');

  if (!isAuthorizedUser(userId)) {
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'No autorizado.',
      show_alert: true
    });
    return;
  }

  const [action, offerId] = String(callback.data || '').split(':');
  const offer = await store.get(offerId);

  if (!offer) {
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'Oferta no encontrada.',
      show_alert: true
    });
    return;
  }

  if (action === 'reject') {
    const updated = await store.update(offer.id, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: userId
    });

    await editReviewMessage(callback.message, updated, 'Rechazada');
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'Oferta rechazada.'
    });
    return;
  }

  if (action === 'approve') {
    if (!config.groupChatId) {
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
      sentMessage = await sendPublicOffer(config.groupChatId, offer);
    } catch (error) {
      await telegram.answerCallbackQuery({
        callback_query_id: callback.id,
        text: 'No pude publicar la oferta. Revisa que la imagen sea publica y valida.',
        show_alert: true
      });
      console.error(error.message);
      return;
    }

    const updated = await store.update(offer.id, {
      status: 'published',
      approvedAt: new Date().toISOString(),
      approvedBy: userId,
      telegramMessageId: sentMessage.message_id
    });

    await editReviewMessage(callback.message, updated, 'Publicada');
    await telegram.answerCallbackQuery({
      callback_query_id: callback.id,
      text: 'Oferta publicada en el grupo.'
    });
    return;
  }

  await telegram.answerCallbackQuery({
    callback_query_id: callback.id,
    text: 'Accion no reconocida.',
    show_alert: true
  });
}

async function sendOfferReview(chatId, offer, warnings) {
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: 'Aprobar', callback_data: `approve:${offer.id}` },
        { text: 'Rechazar', callback_data: `reject:${offer.id}` }
      ]
    ]
  };

  const caption = formatReviewCaption(offer, warnings);

  await sendOfferMessage(chatId, offer, caption, replyMarkup);
}

async function sendPublicOffer(chatId, offer) {
  const caption = formatPublicCaption(offer, config.postLanguage);
  return sendOfferMessage(chatId, offer, caption, undefined, { requirePhoto: true });
}

async function sendOfferMessage(chatId, offer, caption, replyMarkup, options = {}) {
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
      console.error(`sendPhoto failed for offer ${offer.id || 'draft'}: ${error.message}`);

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

async function editReviewMessage(message, offer, status) {
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

function helpText(message) {
  const userId = String(message.from?.id || '');
  const chatId = String(message.chat.id);

  return [
    'Bot de aprobacion de ofertas para EclatSkinAtelier.',
    '',
    `Tu user ID: <code>${escapeHtml(userId)}</code>`,
    `Este chat ID: <code>${escapeHtml(chatId)}</code>`,
    '',
    offerUsageText(config),
    '',
    'Comandos:',
    '/offer - Crear una oferta pendiente',
    '/rules - Ver reglas del filtro',
    '/status - Ver estado del bot',
    '/chatid - Ver IDs para configurar Telegram'
  ].join('\n');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
