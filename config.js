// config.js - Конфигурация приложения
// ВНИМАНИЕ: В продакшене используйте переменные окружения!

window.ENV = {
    // Supabase конфигурация
    SUPABASE_URL: 'https://spjuihuxhdzfbxtwkqaj.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwanVpaHV4aGR6ZmJ4dHdrcWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODAyNjIsImV4cCI6MjA3NTM1NjI2Mn0.eloy71G4miR3sTgE3o2R0gYJ_Zyd00Bjl7fCym5K0UI',
    
    // OpenAI API конфигурация
    OPENAI_API_KEY: 'sk-6bdcdbfd4d9b4da4b50676ceacce8784',
    OPENAI_MODEL: 'gpt-3.5-turbo',
    
    // Настройки приложения
    APP_NAME: 'AI-TAP',
    APP_VERSION: '1.0.0',
    
    // ID администраторов
    ADMIN_IDS: [1485058648],
    
    // Настройки кэша
    CACHE_SIZE: 100,
    CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 часа
    
    // Настройки чата
    MAX_MESSAGE_LENGTH: 4000,
    MAX_CHAT_HISTORY: 100,
    
    // Настройки производительности
    DEBOUNCE_DELAY: 300,
    AUTO_SAVE_INTERVAL: 5 * 60 * 1000, // 5 минут
    
    // Настройки безопасности
    ENABLE_XSS_PROTECTION: true,
    ENABLE_INPUT_VALIDATION: true,
    
    // Настройки отладки
    DEBUG_MODE: false,
    LOG_LEVEL: 'error' // 'debug', 'info', 'warn', 'error'
};

// Утилиты для работы с конфигурацией
window.ConfigUtils = {
    // Получение значения конфигурации
    get(key, defaultValue = null) {
        return window.ENV && window.ENV[key] !== undefined ? window.ENV[key] : defaultValue;
    },
    
    // Проверка режима отладки
    isDebug() {
        return this.get('DEBUG_MODE', false);
    },
    
    // Логирование с учетом уровня
    log(level, message, ...args) {
        const logLevel = this.get('LOG_LEVEL', 'error');
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        
        if (levels[level] >= levels[logLevel]) {
            console[level](`[${this.get('APP_NAME', 'AI-TAP')}]`, message, ...args);
        }
    },
    
    // Проверка прав администратора
    isAdmin(userId) {
        const adminIds = this.get('ADMIN_IDS', []);
        return adminIds.includes(userId);
    }
};
