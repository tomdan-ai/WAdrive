import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaFile } from '../database/entities/media-file.entity';
import { MediaService } from './media.service';
import { B2Service } from './b2.service';
import { DownloaderService } from './downloader.service';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [TypeOrmModule.forFeature([MediaFile]), UsersModule],
    providers: [MediaService, B2Service, DownloaderService],
    exports: [MediaService],
})
export class MediaModule { }
