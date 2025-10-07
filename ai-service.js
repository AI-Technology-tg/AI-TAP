// ai-service.js - Сервис для работы с AI API
class AIService {
    constructor() {
        this.apiKey = this.getConfigValue('OPENAI_API_KEY');
        this.model = this.getConfigValue('OPENAI_MODEL', 'gpt-3.5-turbo');
        this.baseUrl = 'https://api.openai.com/v1';
        this.conversationHistory = [];
    }

    // Получение значения конфигурации
    getConfigValue(key, defaultValue) {
        if (typeof window !== 'undefined' && window.ConfigUtils) {
            return window.ConfigUtils.get(key, defaultValue);
        }
        return defaultValue;
    }

    // Добавление сообщения в историю разговора
    addToHistory(role, content) {
        this.conversationHistory.push({ role, content });
        
        // Ограничиваем историю последними 10 сообщениями для экономии токенов
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    // Очистка истории разговора
    clearHistory() {
        this.conversationHistory = [];
    }

    // Генерация ответа с помощью OpenAI API
    async generateResponse(userMessage) {
        if (!this.apiKey) {
            throw new Error('API ключ OpenAI не настроен');
        }

        try {
            // Добавляем сообщение пользователя в историю
            this.addToHistory('user', userMessage);

            // Подготавливаем системное сообщение
            const systemMessage = {
                role: 'system',
                content: `Ты AI-TAP - персональный ИИ-помощник. Отвечай на русском языке, будь полезным, дружелюбным и профессиональным. Помогай пользователю с различными задачами, отвечай на вопросы и поддерживай интересную беседу.`
            };

            // Формируем массив сообщений для API
            const messages = [systemMessage, ...this.conversationHistory];

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    max_tokens: 1000,
                    temperature: 0.7,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API ошибка: ${response.status} - ${errorData.error?.message || 'Неизвестная ошибка'}`);
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Неверный формат ответа от API');
            }

            const aiResponse = data.choices[0].message.content;
            
            // Добавляем ответ ИИ в историю
            this.addToHistory('assistant', aiResponse);

            return aiResponse;

        } catch (error) {
            console.error('Ошибка генерации ответа AI:', error);
            
            // Возвращаем fallback ответ в зависимости от типа ошибки
            if (error.message.includes('API ключ')) {
                return 'Извините, API ключ не настроен. Обратитесь к администратору.';
            } else if (error.message.includes('quota') || error.message.includes('billing')) {
                return 'Извините, превышен лимит запросов. Попробуйте позже.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                return 'Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.';
            } else {
                return 'Извините, произошла ошибка при генерации ответа. Попробуйте еще раз.';
            }
        }
    }

    // Получение статистики использования API
    getUsageStats() {
        return {
            conversationLength: this.conversationHistory.length,
            lastRequest: this.lastRequestTime || null
        };
    }

    // Проверка доступности API
    async checkAPIHealth() {
        if (!this.apiKey) {
            return { status: 'error', message: 'API ключ не настроен' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (response.ok) {
                return { status: 'ok', message: 'API доступен' };
            } else {
                return { status: 'error', message: `API недоступен: ${response.status}` };
            }
        } catch (error) {
            return { status: 'error', message: `Ошибка подключения: ${error.message}` };
        }
    }
}

// Экспорт для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIService;
} else {
    window.AIService = AIService;
}
