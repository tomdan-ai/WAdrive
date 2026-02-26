import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** E.164 format e.g. +2348012345678 */
    @Column({ unique: true })
    phone: string;

    /** Set to true after the welcome message is sent */
    @Column({ default: false })
    onboarded: boolean;

    /** Bytes used out of quota */
    @Column({ type: 'bigint', default: 0 })
    storageUsed: number;

    /** Default 500 MB in bytes */
    @Column({ type: 'bigint', default: 524288000 })
    storageLimit: number;

    /**
     * Tracks if we are waiting for a YES confirmation before deleting account.
     * Stored as a simple flag; reset after any other command.
     */
    @Column({ default: false })
    awaitingDeleteConfirmation: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
