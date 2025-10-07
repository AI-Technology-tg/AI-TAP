// database.js - Работа с базой данных через Supabase (бесплатно)
class Database {
    constructor() {
        // Supabase конфигурация (используем переменные окружения)
        this.supabaseUrl = this.getConfigValue('SUPABASE_URL', 'https://ytkewgcwlybjkvejuttd.supabase.co');
        this.supabaseKey = this.getConfigValue('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0a2V3Z2N3bHliamt2ZWp1dHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTA3OTcsImV4cCI6MjA3NDkyNjc5N30.NouWNVtNG6hmnXhMWRy9Xzv3oSNa1K8TwPwefm1BAQY');
        this.supabase = null;
        this.init();
    }

    // Безопасное получение конфигурации
    getConfigValue(key, defaultValue) {
        // Используем ConfigUtils если доступен
        if (typeof window !== 'undefined' && window.ConfigUtils) {
            return window.ConfigUtils.get(key, defaultValue);
        }
        // Fallback на прямое обращение к ENV
        if (typeof window !== 'undefined' && window.ENV && window.ENV[key]) {
            return window.ENV[key];
        }
        return defaultValue;
    }

    async init() {
        // Инициализация Supabase
        if (typeof window !== 'undefined') {
            const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        }
    }

    // Валидация входных данных
    validateInput(data, rules) {
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (!value || value.toString().trim() === '')) {
                throw new Error(`Поле ${field} обязательно для заполнения`);
            }
            
            if (value && rule.maxLength && value.toString().length > rule.maxLength) {
                throw new Error(`Поле ${field} не должно превышать ${rule.maxLength} символов`);
            }
            
            if (value && rule.type === 'number' && isNaN(Number(value))) {
                throw new Error(`Поле ${field} должно быть числом`);
            }
            
            if (value && rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                throw new Error(`Поле ${field} должно быть валидным email`);
            }
        }
        return true;
    }

    // Санитизация контента для предотвращения XSS
    sanitizeContent(content) {
        if (typeof content !== 'string') return '';
        
        return content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }

    // Сохранение сообщения в базу
    async saveMessage(telegramId, role, content) {
        if (!this.supabase) {
            throw new Error('База данных не инициализирована');
        }
        
        try {
            // Валидация входных данных
            this.validateInput(
                { telegramId, role, content },
                {
                    telegramId: { required: true, type: 'number' },
                    role: { required: true, maxLength: 20 },
                    content: { required: true, maxLength: 4000 }
                }
            );
            
            // Санитизация контента
            const sanitizedContent = this.sanitizeContent(content);
            
            const { data, error } = await this.supabase
                .from('messages')
                .insert([
                    {
                        telegram_id: telegramId,
                        role: role,
                        content: sanitizedContent,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка сохранения сообщения:', error);
            throw error; // Пробрасываем ошибку для обработки в UI
        }
    }

    // Получение истории чата
    async getChatHistory(telegramId, limit = 20) {
        if (!this.supabase) {
            console.warn('База данных не инициализирована');
            return [];
        }
        
        try {
            // Валидация входных данных
            this.validateInput(
                { telegramId, limit },
                {
                    telegramId: { required: true, type: 'number' },
                    limit: { type: 'number' }
                }
            );
            
            const { data, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('telegram_id', telegramId)
                .order('created_at', { ascending: true })
                .limit(Math.min(limit, 100)); // Ограничиваем максимум 100 сообщений
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Ошибка получения истории:', error);
            return [];
        }
    }

    // Сохранение пользователя
    async saveUser(telegramId, username, firstName) {
        if (!this.supabase) {
            console.warn('База данных не инициализирована');
            return null;
        }
        
        try {
            // Валидация входных данных
            this.validateInput(
                { telegramId, username, firstName },
                {
                    telegramId: { required: true, type: 'number' },
                    username: { maxLength: 50 },
                    firstName: { maxLength: 100 }
                }
            );
            
            const { data, error } = await this.supabase
                .from('users')
                .upsert([
                    {
                        telegram_id: telegramId,
                        username: this.sanitizeContent(username || ''),
                        first_name: this.sanitizeContent(firstName || ''),
                        last_seen: new Date().toISOString()
                    }
                ]);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка сохранения пользователя:', error);
            throw error;
        }
    }

    // Получение статистики API
    async getApiStats() {
        if (!this.supabase) return {};
        
        try {
            const { data, error } = await this.supabase
                .from('api_usage')
                .select('*')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
            
            if (error) throw error;
            
            const stats = {
                totalRequests: data.length,
                requestsPerHour: this.calculateRequestsPerHour(data),
                topUsers: this.getTopUsers(data)
            };
            
            return stats;
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return {};
        }
    }

    // Сохранение использования API
    async logApiUsage(telegramId, tokensUsed, responseTime) {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .from('api_usage')
                .insert([
                    {
                        telegram_id: telegramId,
                        tokens_used: tokensUsed,
                        response_time: responseTime,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка логирования API:', error);
        }
    }

    calculateRequestsPerHour(data) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        return data.filter(item => 
            new Date(item.created_at) > oneHourAgo
        ).length;
    }

    getTopUsers(data) {
        const userCounts = {};
        data.forEach(item => {
            userCounts[item.telegram_id] = (userCounts[item.telegram_id] || 0) + 1;
        });
        
        return Object.entries(userCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([telegramId, count]) => ({ telegramId, count }));
    }
}

// Экспорт для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Database;
} else {
    window.Database = Database;
}
