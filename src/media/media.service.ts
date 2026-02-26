import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MediaFile, MediaType } from '../database/entities/media-file.entity';
import { User } from '../database/entities/user.entity';
import { B2Service } from './b2.service';
import { DownloaderService } from './downloader.service';
import { UsersService } from '../users/users.service';

/** Map Twilio ContentType to our media type categories */
function resolveMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

/** Derive a file extension from a MIME type */
function extFromMime(mimeType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/3gpp': '3gp',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/aac': 'aac',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            'docx',
    };
    return map[mimeType] ?? 'bin';
}

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);
    private readonly accountSid: string;
    private readonly authToken: string;

    constructor(
        @InjectRepository(MediaFile)
        private readonly mediaRepo: Repository<MediaFile>,
        private readonly b2: B2Service,
        private readonly downloader: DownloaderService,
        private readonly usersService: UsersService,
        private readonly config: ConfigService,
    ) {
        this.accountSid = config.get<string>('twilio.accountSid') as string;
        this.authToken = config.get<string>('twilio.authToken') as string;
    }

    /**
     * Handle an incoming media backup request.
     * Returns a reply string for the user.
     */
    async handleIncoming(
        user: User,
        mediaUrl: string,
        mimeType: string,
    ): Promise<string> {
        // Download from Twilio
        const buffer = await this.downloader.download(
            mediaUrl,
            this.accountSid,
            this.authToken,
        );

        const fileSize = buffer.length;

        // Quota check
        const storageUsed = Number(user.storageUsed);
        const storageLimit = Number(user.storageLimit);
        if (storageUsed + fileSize > storageLimit) {
            const usedMb = (storageUsed / 1024 / 1024).toFixed(1);
            const limitMb = (storageLimit / 1024 / 1024).toFixed(0);
            return (
                `⚠️ Storage full! You've used ${usedMb} MB of ${limitMb} MB.\n\n` +
                `To continue backing up files, you'll need to upgrade your plan.\n` +
                `Reply *upgrade* to learn about our Pro plan (20GB for ₦1,500/month).`
            );
        }

        const mediaType = resolveMediaType(mimeType);
        const ext = extFromMime(mimeType);
        const fileId = uuidv4();
        const filename = `${fileId}.${ext}`;
        const b2Key = `users/${user.id}/${mediaType}s/${filename}`;

        // Checksum
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

        // Upload to B2
        await this.b2.upload(b2Key, buffer, mimeType);

        // Save metadata
        const mediaFile = this.mediaRepo.create({
            user: { id: user.id } as User,
            mediaType,
            mimeType,
            fileSize,
            originalFilename: filename,
            b2Key,
            checksum,
        });
        await this.mediaRepo.save(mediaFile);

        // Update storage usage
        user.storageUsed = storageUsed + fileSize;
        await this.usersService.save(user);

        const fileSizeKb = (fileSize / 1024).toFixed(1);
        const usedMbNow = (Number(user.storageUsed) / 1024 / 1024).toFixed(1);
        const limitMb = (storageLimit / 1024 / 1024).toFixed(0);

        return (
            `☁️ *Backed up securely!*\n` +
            `📄 ${filename} (${fileSizeKb} KB)\n` +
            `📦 Storage: ${usedMbNow} MB / ${limitMb} MB`
        );
    }

    /**
     * Get files for a user filtered by mediaType.
     * @param limit max results (default 10)
     */
    async getFilesForUser(
        userId: string,
        mediaType?: MediaType,
        limit = 10,
    ): Promise<MediaFile[]> {
        const qb = this.mediaRepo
            .createQueryBuilder('f')
            .where('f.user_id = :userId', { userId })
            .orderBy('f.createdAt', 'DESC')
            .take(limit);

        if (mediaType) {
            qb.andWhere('f.mediaType = :mediaType', { mediaType });
        }

        return qb.getMany();
    }

    /**
     * Delete all media files for a user (DB + B2).
     */
    async deleteAllForUser(userId: string): Promise<void> {
        const files = await this.mediaRepo.find({
            where: { user: { id: userId } },
        });
        // Delete from B2
        await this.b2.deletePrefix(`users/${userId}/`);
        // Delete metadata
        if (files.length > 0) {
            await this.mediaRepo.remove(files);
        }
    }

    /**
     * Generate a pre-signed URL for a media file.
     */
    async getPresignedUrl(file: MediaFile): Promise<string> {
        return this.b2.getPresignedUrl(file.b2Key);
    }
}
