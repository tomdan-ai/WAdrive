import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly secretKey: string;

    constructor(private readonly config: ConfigService) {
        this.secretKey = this.config.get<string>('app.paystackSecretKey') as string;
    }

    /**
     * Initialize a Paystack transaction and return the authorization URL.
     */
    async initializeTransaction(email: string, amount: number, metadata: any): Promise<string> {
        try {
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    email,
                    amount: amount * 100, // Convert to kobo/cents
                    metadata,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            return response.data.data.authorization_url;
        } catch (error) {
            this.logger.error(`Failed to initialize Paystack: ${error.response?.data?.message || error.message}`);
            throw new Error('Payment initialization failed');
        }
    }

    /**
     * Verify Paystack webhook signature.
     */
    verifySignature(body: any, signature: string): boolean {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha512', this.config.get<string>('app.paystackWebhookSecret'))
            .update(JSON.stringify(body))
            .digest('hex');
        return hash === signature;
    }
}
