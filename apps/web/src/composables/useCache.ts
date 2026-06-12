interface CacheEntry {
    data: unknown;
    expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function clearApiCache(): void {
    cache.clear();
};

export function useCache() {
    function get<T>(key: string): T | null {
        const entry = cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            cache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    function set(key: string, data: unknown, ttl = 30_000): void {
        cache.set(key, { data, expiresAt: Date.now() + ttl });
    };

    function invalidate(key: string): void {
        cache.delete(key);
    }

    function invalidatePrefix(prefix: string): void {
        for (const key of cache.keys()) {
            if (key.startsWith(prefix)) cache.delete(key);
        }
    }

    return { get, set, invalidate, invalidatePrefix };
}