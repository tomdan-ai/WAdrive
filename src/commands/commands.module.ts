import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
    imports: [MediaModule, UsersModule, MessagingModule],
    providers: [CommandsService],
    exports: [CommandsService],
})
export class CommandsModule { }
