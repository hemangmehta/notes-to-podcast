import winston from 'winston';
import config from '../config/app.js';

const logger = winston.createLogger({
    level: config.environment === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

if (config.environment === 'development') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

export default logger; 