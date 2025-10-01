// cache.js - Кэширование популярных ответов
class ResponseCache {
    constructor() {
        this.cache = new Map();
        this.popularQueries = new Map();
        this.maxCacheSize = 100;
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 часа
    }

    // Генерация ключа кэша
    generateCacheKey(message, language) {
        const normalizedMessage = message.toLowerCase().trim();
        return `${language}_${this.hashString(normalizedMessage)}`;
    }

    // Простая хэш-функция
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // Сохранение в кэш
    setCache(message, language, response) {
        const key = this.generateCacheKey(message, language);
        const cacheData = {
            response: response,
            timestamp: Date.now(),
            hits: 1
        };
        
        this.cache.set(key, cacheData);
        
        // Обновляем статистику популярных запросов
        this.updatePopularQueries(message, language);
        
        // Очищаем старые записи если кэш переполнен
        if (this.cache.size > this.maxCacheSize) {
            this.cleanupCache();
        }
    }

    // Получение из кэша
    getCache(message, language) {
        const key = this.generateCacheKey(message, language);
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        // Проверяем не истек ли кэш
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        
        // Увеличиваем счетчик использования
        cached.hits++;
        
        return cached.response;
    }

    // Обновление статистики популярных запросов
    updatePopularQueries(message, language) {
        const queryKey = `${language}_${message.toLowerCase()}`;
        const current = this.popularQueries.get(queryKey) || 0;
        this.popularQueries.set(queryKey, current + 1);
    }

    // Очистка устаревшего кэша
    cleanupCache() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        
        // Сортируем по времени создания
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Удаляем самые старые записи
        const toDelete = entries.slice(0, Math.floor(this.maxCacheSize * 0.2));
        toDelete.forEach(([key]) => this.cache.delete(key));
    }

    // Получение популярных запросов
    getPopularQueries(limit = 10) {
        return Array.from(this.popularQueries.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([query, hits]) => ({ query, hits }));
    }

    // Получение статистики кэша
    getCacheStats() {
        const totalEntries = this.cache.size;
        const totalHits = Array.from(this.cache.values())
            .reduce((sum, item) => sum + item.hits, 0);
        
        const avgHits = totalHits / totalEntries || 0;
        
        return {
            totalEntries,
            totalHits,
            averageHits: Math.round(avgHits * 100) / 100,
            popularQueries: this.getPopularQueries(5)
        };
    }

    // Очистка всего кэша
    clearCache() {
        this.cache.clear();
        this.popularQueries.clear();
    }

    // Сохранение кэша в localStorage
    saveToLocalStorage() {
        try {
            const cacheData = {
                cache: Array.from(this.cache.entries()),
                popularQueries: Array.from(this.popularQueries.entries()),
                timestamp: Date.now()
            };
            localStorage.setItem('ai-tap-cache', JSON.stringify(cacheData));
        } catch (error) {
            console.error('Ошибка сохранения кэша:', error);
        }
    }

    // Загрузка кэша из localStorage
    loadFromLocalStorage() {
        try {
            const cacheData = localStorage.getItem('ai-tap-cache');
            if (!cacheData) return;
            
            const parsed = JSON.parse(cacheData);
            
            // Проверяем не устарел ли кэш (больше 7 дней)
            if (Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem('ai-tap-cache');
                return;
            }
            
            this.cache = new Map(parsed.cache);
            this.popularQueries = new Map(parsed.popularQueries);
        } catch (error) {
            console.error('Ошибка загрузки кэша:', error);
        }
    }
}

// Экспорт для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponseCache;
} else {
    window.ResponseCache = ResponseCache;
}
