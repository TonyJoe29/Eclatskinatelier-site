import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
export const botRoot = path.resolve(srcDir, '..');
export const repoRoot = path.resolve(botRoot, '..');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.join(repoRoot, '.env'));
loadDotEnv(path.join(botRoot, '.env'));

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const categoryAliases = new Map([
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

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || '',
  amazonAssociateTag: process.env.AMAZON_ASSOCIATE_TAG || 'luxeskinateli-20',
  postLanguage: (process.env.POST_LANGUAGE || 'en').toLowerCase(),
  minDiscountPercent: numberFromEnv('MIN_DISCOUNT_PERCENT', 5),
  minReviewCount: numberFromEnv('MIN_REVIEW_COUNT', 1000),
  minRating: numberFromEnv('MIN_RATING', 4),
  dataFile: process.env.OFFERS_DATA_FILE
    ? path.resolve(botRoot, process.env.OFFERS_DATA_FILE)
    : path.join(botRoot, 'data', 'offers.json')
};

export function validateStartupConfig() {
  const missing = [];

  if (!config.telegramBotToken) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }

  if (!config.amazonAssociateTag) {
    missing.push('AMAZON_ASSOCIATE_TAG');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function isAuthorizedUser(userId) {
  if (!config.adminChatId) {
    return true;
  }

  return String(userId) === String(config.adminChatId);
}

export function adminIsConfigured() {
  return Boolean(config.adminChatId);
}
