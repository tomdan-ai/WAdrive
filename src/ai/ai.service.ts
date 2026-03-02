import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private genAI: GoogleGenerativeAI;
    private model: any;
    private visionModel: any;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('app.geminiApiKey');
        if (!apiKey) {
            this.logger.error('GEMINI_API_KEY is not set');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            this.visionModel = this.genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
            });
        }
    }

    /**
     * Generates tags and a caption for an uploaded file using Gemini Vision.
     */
    async generateTagsAndCaption(
        buffer: Buffer,
        mimeType: string,
    ): Promise<{ tags: string[]; caption: string; extractedText?: string }> {
        try {
            if (!this.genAI) return { tags: [], caption: 'AI service unavailable' };

            const prompt = `
        Analyze this file and provide:
        1. A short, human-readable caption (one sentence).
        2. A list of 5-10 relevant tags (e.g., receipt, document, wedding, cat, invoice, etc.).
        3. Extract any clear text found in the image (especially for documents/receipts).
        
        Return the result as a JSON object with keys: "caption", "tags", "extractedText".
      `;

            const part: Part = {
                inlineData: {
                    data: buffer.toString('base64'),
                    mimeType,
                },
            };

            const result = await this.visionModel.generateContent([prompt, part]);
            const response = await result.response;
            const text = response.text();

            // Clean the response (sometimes Gemini wrapped in markdown blocks)
            const jsonStr = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(jsonStr);

            return {
                tags: parsed.tags || [],
                caption: parsed.caption || 'No caption generated',
                extractedText: parsed.extractedText || '',
            };
        } catch (error) {
            this.logger.error(
                `Failed to generate tags: ${(error as Error).message}`,
                (error as Error).stack,
            );
            return { tags: [], caption: 'AI tagging failed' };
        }
    }

    /**
     * Detects the user's intent from a text message.
     */
    async detectIntent(text: string): Promise<{
        intent: 'retrieve' | 'storage' | 'delete' | 'help' | 'unknown';
        filters?: {
            tag?: string;
            mediaType?: string;
            dateRange?: string;
        };
    }> {
        try {
            if (!this.genAI) return { intent: 'unknown' };

            const prompt = `
        Analyze the following WhatsApp message from a user of a cloud storage service called WADrive.
        Determine the intent and extract any filters (tag, media type, date relative to today).
        
        Intents: "retrieve", "storage", "delete", "help", "unknown"
        Today's date: ${new Date().toDateString()}
        
        User message: "${text}"
        
        Return the result as a JSON object with keys: "intent", "filters" (optional object with "tag", "mediaType", "dateRange").
      `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();

            const jsonStr = responseText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(jsonStr);

            return parsed;
        } catch (error) {
            this.logger.error(`Failed to detect intent: ${(error as Error).message}`);
            return { intent: 'unknown' };
        }
    }
}
