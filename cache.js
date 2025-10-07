// cache.js - Кэширование популярных ответов
class ResponseCache {
    constructor() {
        this.cache = new Map();
        this.popularQueries = new Map();
        this.maxCacheSize = this.getConfigValue('CACHE_SIZE', 100);
        this.cacheExpiry = this.getConfigValue('CACHE_EXPIRY', 24 * 60 * 60 * 1000); // 24 часа
    }

    // Получение значения конфигурации
    getConfigValue(key, defaultValue) {
        if (typeof window !== 'undefined' && window.ConfigUtils) {
            return window.ConfigUtils.get(key, defaultValue);
        }
        return defaultValue;
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
        if (!message || !response) return;
        
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
        if (!message) return null;
        
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
            if (typeof localStorage === 'undefined') {
                console.warn('localStorage недоступен');
                return;
            }
            
            const cacheData = {
                cache: Array.from(this.cache.entries()),
                popularQueries: Array.from(this.popularQueries.entries()),
                timestamp: Date.now()
            };
            
            const serialized = JSON.stringify(cacheData);
            
            // Проверяем размер данных (localStorage имеет ограничения)
            if (serialized.length > 5 * 1024 * 1024) { // 5MB
                console.warn('Кэш слишком большой, очищаем старые записи');
                this.cleanupCache();
                return this.saveToLocalStorage(); // Рекурсивный вызов после очистки
            }
            
            localStorage.setItem('ai-tap-cache', serialized);
        } catch (error) {
            console.error('Ошибка сохранения кэша:', error);
            // Если localStorage переполнен, очищаем кэш
            if (error.name === 'QuotaExceededError') {
                this.clearCache();
            }
        }
    }

    // Загрузка кэша из localStorage
    loadFromLocalStorage() {
        try {
            if (typeof localStorage === 'undefined') {
                console.warn('localStorage недоступен');
                return;
            }
            
            const cacheData = localStorage.getItem('ai-tap-cache');
            if (!cacheData) return;
            
            const parsed = JSON.parse(cacheData);
            
            // Проверяем структуру данных
            if (!parsed || typeof parsed.timestamp !== 'number') {
                console.warn('Неверный формат кэша, очищаем');
                localStorage.removeItem('ai-tap-cache');
                return;
            }
            
            // Проверяем не устарел ли кэш (больше 7 дней)
            if (Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem('ai-tap-cache');
                return;
            }
            
            // Восстанавливаем кэш с проверкой данных
            if (Array.isArray(parsed.cache)) {
                this.cache = new Map(parsed.cache);
            }
            
            if (Array.isArray(parsed.popularQueries)) {
                this.popularQueries = new Map(parsed.popularQueries);
            }
        } catch (error) {
            console.error('Ошибка загрузки кэша:', error);
            // Очищаем поврежденный кэш
            try {
                localStorage.removeItem('ai-tap-cache');
            } catch (e) {
                console.error('Не удалось очистить поврежденный кэш:', e);
            }
        }
    }
}

// Экспорт для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponseCache;
} else {
    window.ResponseCache = ResponseCache;
}
