import { Injectable } from '@nestjs/common';
import { User } from '../database/entities/user.entity';
import { MediaType } from '../database/entities/media-file.entity';
import { MediaService } from '../media/media.service';
import { UsersService } from '../users/users.service';
import { MessagingService } from '../messaging/messaging.service';
import { AiService } from '../ai/ai.service';

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
✨ *WADrive Pro — 20GB for ₦1,500/month*

Get 40× more storage, plus:
• Priority backup
• Smart search (coming soon)

To upgrade, visit: https://wadrive.app/upgrade
(Payments coming soon inside WhatsApp!)
`.trim();

@Injectable()
export class CommandsService {
    constructor(
        private readonly mediaService: MediaService,
        private readonly usersService: UsersService,
        private readonly messaging: MessagingService,
        private readonly aiService: AiService,
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
            await this.messaging.sendText(`whatsapp:${user.phone}`, UPGRADE_MESSAGE);
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

        let msg = `📦 *Your WADrive Storage*\n\nUsed: ${usedMb} MB of ${limitMb} MB\n[${bar}] ${pct}%\nRemaining: ${((limit - used) / 1024 / 1024).toFixed(1)} MB`;

        if (pct >= 90) {
            msg += `\n\n⚠️ You're almost full! Reply *upgrade* to get 20GB for ₦1,500/month.`;
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
}
