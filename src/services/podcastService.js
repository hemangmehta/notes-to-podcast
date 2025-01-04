import { TextProcessingService } from './textProcessingService.js';
import { AudioService } from './audioService.js';
import { SummaryService } from './summaryService.js';
import logger from '../utils/logger.js';

export class PodcastService {
    constructor() {
        this.textProcessor = new TextProcessingService();
        this.audioService = new AudioService();
        this.summaryService = new SummaryService();
    }

    async generatePodcast(input, isFile = true) {
        try {
            logger.info('Starting podcast generation');

            // Extract or use raw text
            const text = isFile 
                ? await this.textProcessor.extractText(input)
                : input;

            // Generate conversation and summary in parallel
            const [discussion, summary] = await Promise.all([
                this.textProcessor.generateDiscussion(text),
                this.summaryService.generateSummary(text)
            ]);

            // Generate audio
            const audioFile = await this.audioService.generateAudio(discussion);

            return {
                audioFile,
                summary
            };
        } catch (error) {
            logger.error('Error in podcast generation:', error);
            throw error;
        }
    }
} 