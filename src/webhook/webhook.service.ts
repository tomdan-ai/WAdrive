import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { MediaService } from '../media/media.service';
import { CommandsService } from '../commands/commands.service';
import { MessagingService } from '../messaging/messaging.service';

const WELCOME_MESSAGE = `👋 Welcome to *WADrive* — Storage Made Easy!

I'll keep your photos, videos, voice notes, and documents safe in the cloud. Simply forward anything you want to back up here.

🔒 *Privacy*: Your files are stored privately and only you can access them.
📦 *Free Storage*: You get 500MB free to start.

To get started, just forward a file!
Type *help* anytime to see all available commands.`;

const RATE_LIMIT_MESSAGE = `⚠️ You're uploading too fast! Please slow down — max 20 files per hour.`;

/** In-memory rate limiter (upgradeable to Redis). */
interface RateLimitEntry {
    count: number;
    windowStart: number;
}

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);
    private readonly rateLimitMap = new Map<string, RateLimitEntry>();
    private readonly rateLimitPerHour: number;

    constructor(
        private readonly usersService: UsersService,
        private readonly mediaService: MediaService,
        private readonly commandsService: CommandsService,
        private readonly messaging: MessagingService,
        private readonly config: ConfigService,
    ) {
        this.rateLimitPerHour =
            config.get<number>('storage.rateLimitPerHour') ?? 20;
    }

    /**
     * Main entry point — called for every inbound WhatsApp message.
     */
    async handleInbound(body: Record<string, string>): Promise<void> {
        const rawFrom = body['From'] ?? '';
        const phone = rawFrom.replace('whatsapp:', '');
        const messageBody = (body['Body'] ?? '').trim();
        const numMedia = parseInt(body['NumMedia'] ?? '0', 10);
        const waTo = `whatsapp:${phone}`;

        this.logger.log(`Inbound from ${phone}: "${messageBody}" (${numMedia} media)`);

        // Find or create user
        const { user, isNew } = await this.usersService.findOrCreate(phone);

        // Onboarding — first-ever message
        if (isNew || !user.onboarded) {
            user.onboarded = true;
            await this.usersService.save(user);
            await this.messaging.sendText(waTo, WELCOME_MESSAGE);
            // If they also sent media/text on first message, continue processing below
        }

        // Handle media backup
        if (numMedia > 0) {
            if (!this.checkRateLimit(phone)) {
                await this.messaging.sendText(waTo, RATE_LIMIT_MESSAGE);
                return;
            }

            for (let i = 0; i < numMedia; i++) {
                const mediaUrl = body[`MediaUrl${i}`];
                const mimeType = body[`MediaContentType${i}`] ?? 'application/octet-stream';

                const reply = await this.mediaService.handleIncoming(user, mediaUrl, mimeType);
                await this.messaging.sendText(waTo, reply);
                // Refresh user after first file updates storageUsed
                const refreshed = await this.usersService.findByPhone(phone);
                if (refreshed) Object.assign(user, refreshed);
            }
            return;
        }

        // Handle text commands (skip on first-ever empty greeting)
        if (messageBody) {
            const freshUser = await this.usersService.findByPhone(phone);
            if (freshUser) await this.commandsService.handle(freshUser, messageBody);
        }
    }

    // ─── Rate Limiter ────────────────────────────────────────────────────────

    private checkRateLimit(phone: string): boolean {
        const now = Date.now();
        const windowMs = 60 * 60 * 1000; // 1 hour
        const entry = this.rateLimitMap.get(phone);

        if (!entry || now - entry.windowStart > windowMs) {
            this.rateLimitMap.set(phone, { count: 1, windowStart: now });
            return true;
        }

        if (entry.count >= this.rateLimitPerHour) {
            return false;
        }

        entry.count++;
        return true;
    }
}
