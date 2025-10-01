// database.js - Работа с базой данных через Supabase (бесплатно)
class Database {
    constructor() {
        // Supabase конфигурация (бесплатная)
        this.supabaseUrl = 'https://ytkewgcwlybjkvejuttd.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0a2V3Z2N3bHliamt2ZWp1dHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTA3OTcsImV4cCI6MjA3NDkyNjc5N30.NouWNVtNG6hmnXhMWRy9Xzv3oSNa1K8TwPwefm1BAQY';
        this.supabase = null;
        this.init();
    }

    async init() {
        // Инициализация Supabase
        if (typeof window !== 'undefined') {
            const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        }
    }

    // Сохранение сообщения в базу
    async saveMessage(telegramId, role, content) {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .insert([
                    {
                        telegram_id: telegramId,
                        role: role,
                        content: content,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка сохранения сообщения:', error);
        }
    }

    // Получение истории чата
    async getChatHistory(telegramId, limit = 20) {
        if (!this.supabase) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('telegram_id', telegramId)
                .order('created_at', { ascending: true })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Ошибка получения истории:', error);
            return [];
        }
    }

    // Сохранение пользователя
    async saveUser(telegramId, username, firstName) {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .from('users')
                .upsert([
                    {
                        telegram_id: telegramId,
                        username: username,
                        first_name: firstName,
                        last_seen: new Date().toISOString()
                    }
                ]);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка сохранения пользователя:', error);
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
