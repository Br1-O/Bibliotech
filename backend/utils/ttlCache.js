/**
* Project     : Bibliotech  |  Capa: Aplicacion / Utilidades
* Cache TTL en memoria para datos de referencia de baja escritura.
*/

class TtlCache {
    constructor({ ttlMs = 60000, maxEntries = 200 } = {}) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.entries = new Map();
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key, value) {
        if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
            const oldest = this.entries.keys().next().value;
            this.entries.delete(oldest);
        }
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
    }

    async getOrSet(key, loader) {
        const cached = this.get(key);
        if (cached !== undefined) return cached;
        return this.set(key, await loader());
    }

    delete(key) {
        this.entries.delete(key);
    }

    clear() {
        this.entries.clear();
    }
}

module.exports = TtlCache;
