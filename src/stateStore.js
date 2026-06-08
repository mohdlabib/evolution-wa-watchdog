import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export function defaultState() {
  return {
    instances: {},
    alerts: {},
    lastCheckAt: null,
    lastSummary: [],
  };
}

export class JsonStateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!existsSync(this.filePath)) return defaultState();
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
      return { ...defaultState(), ...parsed };
    } catch (err) {
      console.warn(`[STATE] Failed to read state file, using fresh state: ${err.message}`);
      return defaultState();
    }
  }

  save(state) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }
}
