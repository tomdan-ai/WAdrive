import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

@Entity('media_files')
@Index(['user', 'mediaType'])
export class MediaFile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    /** image | video | audio | document */
    @Column()
    mediaType: MediaType;

    /** MIME type e.g. image/jpeg */
    @Column()
    mimeType: string;

    /** File size in bytes */
    @Column({ type: 'bigint' })
    fileSize: number;

    /** Original filename from Twilio, or generated */
    @Column()
    originalFilename: string;

    /** Path/key inside B2 bucket */
    @Column()
    b2Key: string;

    /** SHA-256 hex checksum of the raw file */
    @Column()
    checksum: string;

    @CreateDateColumn()
    createdAt: Date;
}
