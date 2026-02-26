import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly config: ConfigService,
    ) { }

    /**
     * Find an existing user by phone number, or create a new one.
     * Returns { user, isNew } so callers know whether to send onboarding.
     */
    async findOrCreate(phone: string): Promise<{ user: User; isNew: boolean }> {
        let user = await this.userRepo.findOne({ where: { phone } });
        if (user) return { user, isNew: false };

        const freeTierBytes = this.config.get<number>('storage.freeTierBytes') ?? 524288000;
        user = this.userRepo.create({ phone, storageLimit: freeTierBytes });
        await this.userRepo.save(user);
        return { user, isNew: true };
    }

    async save(user: User): Promise<User> {
        return this.userRepo.save(user);
    }

    async findByPhone(phone: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { phone } });
    }

    async deleteUser(user: User): Promise<void> {
        await this.userRepo.remove(user);
    }
}
