import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class DownloaderService {
    private readonly logger = new Logger(DownloaderService.name);

    /**
     * Download a Twilio media URL into a Buffer.
     * Twilio requires Basic Auth using account SID + auth token.
     */
    async download(
        mediaUrl: string,
        accountSid: string,
        authToken: string,
    ): Promise<Buffer> {
        this.logger.log(`Downloading media: ${mediaUrl}`);
        const response = await axios.get<ArrayBuffer>(mediaUrl, {
            responseType: 'arraybuffer',
            auth: { username: accountSid, password: authToken },
        });
        return Buffer.from(response.data);
    }
}
