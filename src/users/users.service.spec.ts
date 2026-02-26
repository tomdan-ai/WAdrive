import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { ConfigService } from '@nestjs/config';

describe('UsersService', () => {
    let service: UsersService;
    const mockRepo = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
    };
    const mockConfig = { get: jest.fn().mockReturnValue(524288000) };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: mockRepo },
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();
        service = module.get<UsersService>(UsersService);
    });

    it('should create a new user when phone is not found', async () => {
        mockRepo.findOne.mockResolvedValue(null);
        const newUser = { id: 'u1', phone: '+2348000000000', onboarded: false };
        mockRepo.create.mockReturnValue(newUser);
        mockRepo.save.mockResolvedValue(newUser);

        const { user, isNew } = await service.findOrCreate('+2348000000000');
        expect(isNew).toBe(true);
        expect(user.phone).toBe('+2348000000000');
        expect(mockRepo.save).toHaveBeenCalledWith(newUser);
    });

    it('should return existing user when phone is found', async () => {
        const existing = { id: 'u1', phone: '+2348000000000', onboarded: true };
        mockRepo.findOne.mockResolvedValue(existing);

        const { user, isNew } = await service.findOrCreate('+2348000000000');
        expect(isNew).toBe(false);
        expect(user).toBe(existing);
        expect(mockRepo.save).not.toHaveBeenCalled();
    });
});
