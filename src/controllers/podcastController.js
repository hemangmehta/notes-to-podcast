import { PodcastService } from '../services/podcastService.js';
import logger from '../utils/logger.js';
import path from 'path';

const podcastService = new PodcastService();

export const generatePodcast = async (req, res, next) => {
    try {
        const input = req.file ? req.file.path : req.body.text;
        const isFile = !!req.file;

        if (!input) {
            throw new Error('No input provided');
        }

        const result = await podcastService.generatePodcast(input, isFile);
        
        const filename = path.basename(result.audioFile);
        
        res.json({
            success: true,
            message: 'Podcast generated successfully',
            audioFile: `/output/${filename}`,
            filename,
            summary: result.summary
        });
    } catch (error) {
        next(error);
    }
};

export const getHome = (req, res) => {
    res.render('pages/index');
}; 