import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);
    private readonly client: twilio.Twilio;
    private readonly from: string;

    constructor(private readonly config: ConfigService) {
        this.client = twilio(
            config.get<string>('twilio.accountSid'),
            config.get<string>('twilio.authToken'),
        );
        this.from = config.get<string>('twilio.whatsappNumber') as string;
    }

    /**
     * Send a plain text WhatsApp message.
     */
    async sendText(to: string, body: string): Promise<void> {
        try {
            await this.client.messages.create({ from: this.from, to, body });
        } catch (err) {
            this.logger.error(`Failed to send text to ${to}: ${(err as Error).message}`);
        }
    }

    /**
     * Re-send a media file to the user (image, audio, document, short video).
     */
    async sendMedia(
        to: string,
        mediaUrl: string,
        caption: string,
    ): Promise<void> {
        try {
            await this.client.messages.create({
                from: this.from,
                to,
                body: caption,
                mediaUrl: [mediaUrl],
            });
        } catch (err) {
            this.logger.error(`Failed to send media to ${to}: ${(err as Error).message}`);
        }
    }
}
