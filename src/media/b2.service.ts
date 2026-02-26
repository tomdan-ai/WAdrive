import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class B2Service {
    private readonly logger = new Logger(B2Service.name);
    private readonly s3: S3Client;
    private readonly bucket: string;
    private readonly signedUrlExpiry: number;

    constructor(private readonly config: ConfigService) {
        this.bucket = config.get<string>('b2.bucketName') as string;
        this.signedUrlExpiry =
            config.get<number>('storage.signedUrlExpirySeconds') ?? 3600;

        this.s3 = new S3Client({
            endpoint: config.get<string>('b2.endpoint'),
            region: config.get<string>('b2.region') ?? 'us-east-005',
            credentials: {
                accessKeyId: config.get<string>('b2.keyId') as string,
                secretAccessKey: config.get<string>('b2.applicationKey') as string,
            },
        });
    }

    /**
     * Upload a file buffer to B2.
     * @param key  Storage path, e.g. "users/{userId}/images/{uuid}.jpg"
     */
    async upload(
        key: string,
        buffer: Buffer,
        mimeType: string,
    ): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        });
        await this.s3.send(command);
        this.logger.log(`Uploaded ${key} (${buffer.length} bytes)`);
    }

    /**
     * Generate a short-lived pre-signed GET URL for a B2 object.
     */
    async getPresignedUrl(key: string): Promise<string> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
        return getSignedUrl(this.s3, command, { expiresIn: this.signedUrlExpiry });
    }

    /**
     * Delete a single object from B2.
     */
    async deleteObject(key: string): Promise<void> {
        await this.s3.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        this.logger.log(`Deleted ${key}`);
    }

    /**
     * Delete all objects under a given prefix (e.g. all files for a user).
     */
    async deletePrefix(prefix: string): Promise<void> {
        let continuationToken: string | undefined;
        do {
            const list = await this.s3.send(
                new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                }),
            );
            for (const obj of list.Contents ?? []) {
                if (obj.Key) await this.deleteObject(obj.Key);
            }
            continuationToken = list.IsTruncated
                ? list.NextContinuationToken
                : undefined;
        } while (continuationToken);
    }
}
