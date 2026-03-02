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

    /** AI-generated tags */
    @Column('text', { array: true, nullable: true })
    tags: string[];

    /** AI-generated caption or summary */
    @Column({ type: 'text', nullable: true })
    caption: string;

    /** Extracted text from OCR */
    @Column({ type: 'text', nullable: true })
    extractedText: string;

    @CreateDateColumn()
    createdAt: Date;
}
