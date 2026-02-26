import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as twilio from 'twilio';

/**
 * Validates that incoming webhook requests are genuinely from Twilio
 * by verifying the X-Twilio-Signature header.
 */
@Injectable()
export class TwilioSignatureMiddleware implements NestMiddleware {
    private readonly logger = new Logger(TwilioSignatureMiddleware.name);
    private readonly authToken: string;

    constructor(private readonly config: ConfigService) {
        this.authToken = config.get<string>('twilio.authToken') as string;
    }

    use(req: Request, res: Response, next: NextFunction): void {
        // Skip validation in test environments
        if (process.env.NODE_ENV === 'test') {
            next();
            return;
        }

        const signature = req.headers['x-twilio-signature'] as string;

        // When behind ngrok (or any reverse proxy), Twilio signs with the public URL.
        // Use X-Forwarded-* headers to reconstruct the actual URL Twilio called.
        const proto =
            (req.headers['x-forwarded-proto'] as string) || req.protocol;
        const host =
            (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
        const url = `${proto}://${host}${req.originalUrl}`;

        const params = req.body as Record<string, string>;

        const isValid = twilio.validateRequest(
            this.authToken,
            signature,
            url,
            params,
        );

        if (!isValid) {
            this.logger.warn(`Invalid Twilio signature from ${req.ip} (url: ${url})`);
            res.status(403).json({ message: 'Forbidden: Invalid Twilio signature' });
            return;
        }

        next();
    }
}
