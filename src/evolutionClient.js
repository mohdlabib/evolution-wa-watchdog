export class EvolutionClient {
  constructor({ baseUrl, apiKey, timeoutMs = 15000, fetchImpl = globalThis.fetch }) {
    if (!fetchImpl) throw new Error('fetch API is required');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async request(path, { method = 'GET', body = undefined } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      if (!res.ok) {
        const msg = typeof data === 'object' && data ? (data.message || data.error || JSON.stringify(data)) : text;
        throw new Error(`Evolution API ${method} ${path} failed: ${res.status} ${msg}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchInstances() {
    const data = await this.request('/instance/fetchInstances');
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.instances)) return data.instances;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  async connectionState(instanceName) {
    return this.request(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
  }

  async sendText(instanceName, number, text) {
    return this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: { number, text },
    });
  }
}
