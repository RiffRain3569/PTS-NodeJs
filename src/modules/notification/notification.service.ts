import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private bot?: TelegramBot;
    private chatId?: string;

    private getBot(): TelegramBot {
        if (!this.bot) {
            const token = process.env.TELEGRAM_TOKEN;
            if (!token) {
                 console.warn('TELEGRAM_TOKEN not set');
            }
            this.bot = new TelegramBot(token || 'temp_token'); // prevent crash if missing, logic will fail later gracefully
            this.chatId = process.env.TELEGRAM_CHAT_ID;
        }
        return this.bot;
    }

    public async send(text: string): Promise<void> {
        try {
            const bot = this.getBot();
            const chatId = this.chatId;
            if (chatId) {
                await bot.sendMessage(chatId, text);
            } else {
                 console.warn("Telegram Chat ID not found");
            }
        } catch (e) {
            console.error("Telegram send error", e);
        }
    }
}

export const notificationService = new NotificationService();
