import { Injectable } from '@nestjs/common';
import { User } from '../database/entities/user.entity';
import { MediaType } from '../database/entities/media-file.entity';
import { MediaService } from '../media/media.service';
import { UsersService } from '../users/users.service';
import { MessagingService } from '../messaging/messaging.service';
import { AiService } from '../ai/ai.service';
import { PaymentsService } from '../payments/payments.service';

const HELP_MESSAGE = `
🤖 *WADrive Commands*

📁 *Backup*
Simply forward any file, photo, video, voice note, or document to this chat.

📋 *Retrieve*
• \`show my photos\` — Get your backed-up images
• \`show my videos\` — Get your backed-up videos
• \`show my audio\` — Get your voice notes & audio files
• \`show my files\` — Get your documents
• \`recent files\` — Get your 10 most recent uploads

💾 *Account*
• \`storage\` — View your storage usage
• \`delete account\` — Permanently delete all your data

❓ *Help*
• \`help\` — Show this menu
`.trim();

const UPGRADE_MESSAGE = `
✨ *WADrive Pro — 10GB for ₦2,000/month*

Get the storage of 20 free accounts, plus:
• Priority backup & retrieval
• Smart AI Search
• Priority support

To upgrade, visit: https://wadrive.app/upgrade
(Secure payment via Paystack)
`.trim();

@Injectable()
export class CommandsService {
    constructor(
        private readonly mediaService: MediaService,
        private readonly usersService: UsersService,
        private readonly messaging: MessagingService,
        private readonly aiService: AiService,
        private readonly paymentsService: PaymentsService,
    ) { }

    async handle(user: User, text: string): Promise<void> {
        const normalized = text.trim().toLowerCase();

        // --- Delete account confirmation flow ---
        if (user.awaitingDeleteConfirmation) {
            if (normalized === 'yes') {
                await this.handleDeleteConfirmed(user);
            } else {
                user.awaitingDeleteConfirmation = false;
                await this.usersService.save(user);
                await this.messaging.sendText(
                    `whatsapp:${user.phone}`,
                    '✅ Deletion cancelled. Your data is safe.',
                );
            }
            return;
        }

        // --- Command routing ---
        if (normalized === 'storage') {
            await this.handleStorage(user);
        } else if (normalized === 'show my photos') {
            await this.handleRetrieve(user, 'image');
        } else if (normalized === 'show my videos') {
            await this.handleRetrieve(user, 'video');
        } else if (normalized === 'show my audio') {
            await this.handleRetrieve(user, 'audio');
        } else if (normalized === 'show my files' || normalized === 'show my documents') {
            await this.handleRetrieve(user, 'document');
        } else if (normalized === 'recent files') {
            await this.handleRetrieve(user, undefined);
        } else if (normalized === 'delete account') {
            await this.handleDeleteRequest(user);
        } else if (normalized === 'upgrade') {
            await this.handleUpgrade(user);
        } else if (normalized === 'help') {
            await this.messaging.sendText(`whatsapp:${user.phone}`, HELP_MESSAGE);
        } else {
            // Use AI to detect intent
            const aiIntent = await this.aiService.detectIntent(text);

            if (aiIntent.intent === 'retrieve') {
                await this.handleAiRetrieve(user, aiIntent.filters);
            } else if (aiIntent.intent === 'storage') {
                await this.handleStorage(user);
            } else if (aiIntent.intent === 'help') {
                await this.messaging.sendText(`whatsapp:${user.phone}`, HELP_MESSAGE);
            } else {
                // Unknown command — gentle nudge
                await this.messaging.sendText(
                    `whatsapp:${user.phone}`,
                    `I didn't understand that. Type *help* to see available commands, or forward a file to back it up! 😊`,
                );
            }
        }
    }

    // ─── AI Handlers ─────────────────────────────────────────────────────────

    private async handleAiRetrieve(user: User, filters: any): Promise<void> {
        // Basic AI-powered search
        const qb = this.mediaService['mediaRepo'] // Accessing private repo for custom query
            .createQueryBuilder('f')
            .where('f.user_id = :userId', { userId: user.id });

        if (filters.tag) {
            qb.andWhere(':tag = ANY(f.tags) OR f.caption ILIKE :tagSearch OR f.extractedText ILIKE :tagSearch', {
                tag: filters.tag,
                tagSearch: `%${filters.tag}%`
            });
        }

        if (filters.mediaType) {
            qb.andWhere('f.mediaType = :mediaType', { mediaType: filters.mediaType });
        }

        // Simple date filter logic - Gemini identifies relative dates
        if (filters.dateRange) {
            // Note: In a production app, we'd use a better date parser for Gemini's output
            // For now, if Gemini says "last week" or gives a date, we could try to parse it.
            // This is a placeholder for more advanced date filtering.
        }

        const files = await qb.orderBy('f.createdAt', 'DESC').take(10).getMany();

        if (files.length === 0) {
            await this.messaging.sendText(
                `whatsapp:${user.phone}`,
                `📭 I couldn't find any files matching "${filters.tag || 'your request'}".`,
            );
            return;
        }

        await this.messaging.sendText(
            `whatsapp:${user.phone}`,
            `📂 Found ${files.length} matching file${files.length > 1 ? 's' : ''}...`,
        );

        for (const file of files) {
            const url = await this.mediaService.getPresignedUrl(file);
            const date = file.createdAt.toLocaleDateString('en-GB');
            const sizeKb = (Number(file.fileSize) / 1024).toFixed(1);
            const caption = `📄 ${file.originalFilename}\n✨ ${file.caption || 'No caption'}\n📅 ${date} · 💾 ${sizeKb} KB`;
            await this.messaging.sendMedia(`whatsapp:${user.phone}`, url, caption);
        }
    }

    // ─── Handlers ────────────────────────────────────────────────────────────

    private async handleStorage(user: User): Promise<void> {
        const used = Number(user.storageUsed);
        const limit = Number(user.storageLimit);
        const usedMb = (used / 1024 / 1024).toFixed(1);
        const limitMb = (limit / 1024 / 1024).toFixed(0);
        const pct = Math.min(100, Math.round((used / limit) * 100));

        const barFilled = Math.round(pct / 10);
        const bar = '█'.repeat(barFilled) + '░'.repeat(10 - barFilled);

        const planName = user.isPro ? '🚀 *Pro Tier*' : '☁️ *Free Tier*';

        let msg = `📊 *Your Storage Dashboard*\n\n` +
            `Plan: ${planName}\n` +
            `Used: ${usedMb} MB of ${limitMb} MB\n` +
            `[${bar}] ${pct}%\n` +
            `Remaining: ${((limit - used) / 1024 / 1024).toFixed(1)} MB`;

        if (!user.isPro) {
            if (pct >= 80) {
                msg += `\n\n⚠️ *Running low!* Upgrade to Pro for 10GB and never worry about space again. Reply *upgrade* to learn more.`;
            }
        }

        await this.messaging.sendText(`whatsapp:${user.phone}`, msg);
    }

    private async handleRetrieve(
        user: User,
        mediaType?: MediaType,
    ): Promise<void> {
        const files = await this.mediaService.getFilesForUser(
            user.id,
            mediaType,
            10,
        );

        if (files.length === 0) {
            const typeName = mediaType ?? 'files';
            await this.messaging.sendText(
                `whatsapp:${user.phone}`,
                `📭 You have no backed-up ${typeName} yet. Forward some to this chat!`,
            );
            return;
        }

        await this.messaging.sendText(
            `whatsapp:${user.phone}`,
            `📂 Sending you ${files.length} file${files.length > 1 ? 's' : ''}...`,
        );

        for (const file of files) {
            const url = await this.mediaService.getPresignedUrl(file);
            const date = file.createdAt.toLocaleDateString('en-GB');
            const sizeKb = (Number(file.fileSize) / 1024).toFixed(1);
            const caption = `📄 ${file.originalFilename}\n📅 ${date} · 💾 ${sizeKb} KB`;
            await this.messaging.sendMedia(`whatsapp:${user.phone}`, url, caption);
        }
    }

    private async handleDeleteRequest(user: User): Promise<void> {
        user.awaitingDeleteConfirmation = true;
        await this.usersService.save(user);
        await this.messaging.sendText(
            `whatsapp:${user.phone}`,
            `⚠️ *Are you sure?*\n\nThis will permanently delete *all* your backed-up files and your account. This cannot be undone.\n\nReply *YES* to confirm, or anything else to cancel.`,
        );
    }

    private async handleDeleteConfirmed(user: User): Promise<void> {
        const phone = `whatsapp:${user.phone}`;
        await this.mediaService.deleteAllForUser(user.id);
        await this.usersService.deleteUser(user);
        await this.messaging.sendText(
            phone,
            `🗑️ Done. All your files and account data have been permanently deleted.\n\nSorry to see you go. If you ever want to come back, just say hi! 👋`,
        );
    }

    private async handleUpgrade(user: User): Promise<void> {
        try {
            // Paystack requires an email. We'll generate a dummy one from phone.
            const email = `${user.phone}@wadrive.app`;

            const authUrl = await this.paymentsService.initializeTransaction(
                email,
                2000, // ₦2,000
                { phone: user.phone, userId: user.id }
            );

            const msg = `✨ *WADrive Pro — 10GB for ₦2,000/month*\n\n` +
                `Your personal upgrade link is ready:\n${authUrl}\n\n` +
                `Secure payment powered by *Paystack*. Once paid, your account will be upgraded within seconds! 🚀`;

            await this.messaging.sendText(`whatsapp:${user.phone}`, msg);
        } catch (error) {
            await this.messaging.sendText(
                `whatsapp:${user.phone}`,
                `❌ *Something went wrong.* \n\nI couldn't generate your payment link right now. Please try again or type *help* for support.`
            );
        }
    }
}
