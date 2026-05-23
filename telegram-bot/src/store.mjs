import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY_STORE = {
  version: 1,
  offers: []
};

export class OfferStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed.offers)) {
        return { ...EMPTY_STORE };
      }

      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { ...EMPTY_STORE };
      }

      throw error;
    }
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    const tmpFile = `${this.filePath}.tmp`;
    await fs.writeFile(tmpFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(tmpFile, this.filePath);
  }

  async create(offer) {
    const data = await this.read();
    const savedOffer = {
      ...offer,
      id: createOfferId(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    data.offers.unshift(savedOffer);
    await this.write(data);
    return savedOffer;
  }

  async get(id) {
    const data = await this.read();
    return data.offers.find((offer) => offer.id === id) || null;
  }

  async update(id, patch) {
    const data = await this.read();
    const index = data.offers.findIndex((offer) => offer.id === id);

    if (index === -1) {
      return null;
    }

    data.offers[index] = {
      ...data.offers[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await this.write(data);
    return data.offers[index];
  }

  async countByStatus() {
    const data = await this.read();

    return data.offers.reduce((counts, offer) => {
      counts.total += 1;
      counts[offer.status] = (counts[offer.status] || 0) + 1;
      return counts;
    }, { total: 0 });
  }
}

function createOfferId() {
  return `of_${Date.now().toString(36)}`;
}
