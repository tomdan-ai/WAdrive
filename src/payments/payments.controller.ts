import { Controller, Post, Body, Headers, Res, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { UsersService } from '../users/users.service';
import { MessagingService } from '../messaging/messaging.service';

@Controller('payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly usersService: UsersService,
        private readonly messaging: MessagingService,
    ) { }

    @Post('webhook')
    async handleWebhook(
        @Body() body: any,
        @Headers('x-paystack-signature') signature: string,
        @Res() res: Response,
    ) {
        if (!signature || !this.paymentsService.verifySignature(body, signature)) {
            this.logger.warn('Invalid Paystack signature');
            return res.status(HttpStatus.UNAUTHORIZED).send('Invalid signature');
        }

        if (body.event === 'charge.success') {
            const { metadata } = body.data;
            const phone = metadata.phone;
            const user = await this.usersService.findByPhone(phone);

            if (user) {
                await this.usersService.upgradeToPro(user);

                await this.messaging.sendText(
                    `whatsapp:${phone}`,
                    `🎉 *Payment Received!* \n\nYour Pro status is now active. You have 10GB of storage for the next 30 days. Enjoy! 🚀`
                );

                this.logger.log(`Upgraded user ${phone} to Pro`);
            }
        }

        return res.status(HttpStatus.OK).send('OK');
    }
}
