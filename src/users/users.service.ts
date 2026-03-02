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
        if (user) {
            user = await this.checkProStatus(user);
            return { user, isNew: false };
        }

        const freeTierBytes = this.config.get<number>('storage.freeTierBytes') ?? 524288000;
        user = this.userRepo.create({ phone, storageLimit: freeTierBytes });
        await this.userRepo.save(user);
        return { user, isNew: true };
    }

    async save(user: User): Promise<User> {
        return this.userRepo.save(user);
    }

    async findByPhone(phone: string): Promise<User | null> {
        const user = await this.userRepo.findOne({ where: { phone } });
        if (user) {
            return this.checkProStatus(user);
        }
        return null;
    }

    /**
     * Checks if Pro status has expired and updates the user accordingly.
     */
    async checkProStatus(user: User): Promise<User> {
        if (user.isPro && user.proExpiresAt && user.proExpiresAt < new Date()) {
            user.isPro = false;
            user.storageLimit = this.config.get<number>('storage.freeTierBytes') ?? 524288000;
            return this.userRepo.save(user);
        }
        return user;
    }

    /**
     * Upgrades a user to Pro for 30 days and sets limit to 10GB.
     */
    async upgradeToPro(user: User): Promise<User> {
        const proTierBytes = 10 * 1024 * 1024 * 1024; // 10GB
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 30); // 30 days

        user.isPro = true;
        user.proExpiresAt = expiration;
        user.storageLimit = proTierBytes;

        return this.userRepo.save(user);
    }

    async deleteUser(user: User): Promise<void> {
        await this.userRepo.remove(user);
    }
}
