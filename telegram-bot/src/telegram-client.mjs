import { lookup } from 'node:dns';
import https from 'node:https';

export class TelegramClient {
  constructor(token) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call(method, payload = {}) {
    const response = await requestJson(`${this.baseUrl}/${method}`, {
      method: 'POST',
      body: payload
    });

    const result = response.body ? JSON.parse(response.body) : null;

    if (response.statusCode < 200 || response.statusCode >= 300 || !result?.ok) {
      const message = result?.description || response.statusMessage || 'Unknown Telegram API error';
      throw new Error(`${method} failed: ${message}`);
    }

    return result.result;
  }

  getUpdates(payload) {
    return this.call('getUpdates', payload);
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

  setChatDescription(payload) {
    return this.call('setChatDescription', payload);
  }
}

function requestJson(url, options) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const body = JSON.stringify(options.body || {});

    const request = https.request({
      hostname: parsedUrl.hostname,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: options.method || 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      },
      lookup: forceIpv4Lookup,
      timeout: 35000
    }, (response) => {
      let responseBody = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        responseBody += chunk;
      });

      response.on('end', () => {
        resolve({
          statusCode: response.statusCode || 0,
          statusMessage: response.statusMessage || '',
          body: responseBody
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Telegram request timed out after ${request.timeout}ms`));
    });

    request.on('error', reject);
    request.end(body);
  });
}

function forceIpv4Lookup(hostname, options, callback) {
  lookup(hostname, { ...options, family: 4 }, callback);
}
