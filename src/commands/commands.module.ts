import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AiModule } from '../ai/ai.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
    imports: [MediaModule, UsersModule, MessagingModule, AiModule, PaymentsModule],
    providers: [CommandsService],
    exports: [CommandsService],
})
export class CommandsModule { }
