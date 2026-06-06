import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PROFILE = 'ElatSkinAtelier';
const RSS_URL = `https://www.pinterest.com/${PROFILE}/feed.rss`;
const DEFAULT_DAYS = 4;
const DEFAULT_LIMIT = 30;

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function decodeEntities(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeEntities(match?.[1] || '');
}

function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const pinUrl = getTag(item, 'link');
    const id = pinUrl.match(/\/pin\/(\d+)/)?.[1] || '';
    const rawDescription = getTag(item, 'description');
    const rssImageUrl = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
    return {
      id,
      pinUrl,
      publishedAt: new Date(getTag(item, 'pubDate')).toISOString(),
      rssTitle: getTag(item, 'title'),
      rssDescription: rawDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      rssImageUrl,
    };
  });
}

function decodeJsonString(value = '') {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replace(/\\u002F/g, '/').replace(/\\u0026/g, '&').replace(/\\"/g, '"');
  }
}

function findJsonField(segment, field, takeLast = false) {
  const regex = new RegExp(`"${field}":"((?:\\\\.|[^"\\\\])*)"`, 'g');
  const matches = [...segment.matchAll(regex)];
  const match = takeLast ? matches.at(-1) : matches[0];
  return decodeJsonString(match?.[1] || '');
}

function findPinImage(segment) {
  const urls = [...segment.matchAll(/"url":"(https:(?:\\\/|\/){2}i\.pinimg\.com(?:\\\/|\/)[^"]+)"/g)]
    .map((match) => decodeJsonString(match[1]));
  return urls.at(-1) || '';
}

function parsePinPage(html, pin) {
  const marker = `"entityId":"${pin.id}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return { ...pin, parseStatus: 'pin-data-not-found' };

  const before = html.slice(Math.max(0, markerIndex - 30000), markerIndex);
  const after = html.slice(markerIndex, markerIndex + 15000);

  return {
    ...pin,
    gridTitle: findJsonField(before, 'gridTitle', true),
    description: findJsonField(before, 'description', true) || pin.rssDescription,
    imageUrl: findPinImage(before) || pin.rssImageUrl,
    destinationUrl: findJsonField(after, 'link'),
    destinationDomain: findJsonField(after, 'domain'),
    boardUrl: findJsonField(after, 'url'),
    parseStatus: 'ok',
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 EclatSkinAtelier Pinterest sync',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function main() {
  const days = Number(readArg('--days', DEFAULT_DAYS));
  const limit = Number(readArg('--limit', DEFAULT_LIMIT));
  const shouldWrite = process.argv.includes('--write');
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const rss = await fetchText(RSS_URL);
  const recentPins = parseRss(rss)
    .filter((pin) => Date.parse(pin.publishedAt) >= cutoff)
    .slice(0, limit);

  const pins = [];
  for (const pin of recentPins) {
    try {
      pins.push(parsePinPage(await fetchText(pin.pinUrl), pin));
    } catch (error) {
      pins.push({ ...pin, parseStatus: 'fetch-error', error: error.message });
    }
  }

  const result = {
    profile: PROFILE,
    source: RSS_URL,
    generatedAt: new Date().toISOString(),
    lookbackDays: days,
    count: pins.length,
    pins,
  };

  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (shouldWrite) {
    const target = path.resolve('data/pinterest-feed-latest.json');
    await fs.writeFile(target, output, 'utf8');
    console.log(`Wrote ${pins.length} pins to ${target}`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
