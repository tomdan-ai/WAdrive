import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(private readonly webhookService: WebhookService) { }

    /**
     * POST /webhook
     * Twilio sends all inbound WhatsApp messages here as URL-encoded form data.
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Body() body: Record<string, string>,
    ): Promise<string> {
        this.logger.log('Webhook received');
        await this.webhookService.handleInbound(body);
        // Twilio expects a 200 response; empty TwiML body is fine
        return '';
    }
}
