import {
    Module,
    NestModule,
    MiddlewareConsumer,
    RequestMethod,
} from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { TwilioSignatureMiddleware } from './twilio-signature.middleware';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { CommandsModule } from '../commands/commands.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
    imports: [UsersModule, MediaModule, CommandsModule, MessagingModule],
    controllers: [WebhookController],
    providers: [WebhookService],
})
export class WebhookModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(TwilioSignatureMiddleware)
            .forRoutes({ path: 'webhook', method: RequestMethod.POST });
    }
}
