import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            details: err.message
        });
    }

    if (err.name === 'FileError') {
        return res.status(400).json({
            success: false,
            message: 'File Processing Error',
            details: err.message
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        details: config.environment === 'development' ? err.message : undefined
    });
}; 