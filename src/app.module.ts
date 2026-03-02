import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { User } from './database/entities/user.entity';
import { MediaFile } from './database/entities/media-file.entity';
import { WebhookModule } from './webhook/webhook.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // Load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // TypeORM with PostgreSQL
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        entities: [User, MediaFile],
        synchronize: true, // use migrations in production
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    WebhookModule,
    PaymentsModule,
  ],
})
export class AppModule { }
