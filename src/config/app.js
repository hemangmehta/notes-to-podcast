export default {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    
    paths: {
        uploads: 'uploads',
        output: 'output',
        temp: 'temp'
    },
    
    ai: {
        model: 'mistral',
        endpoint: 'http://localhost:11434',
        options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 2048
        }
    },
    
    audio: {
        voices: {
            host: {
                language: 'en-us',
                speed: 1.0
            },
            guest: {
                language: 'en-uk',
                speed: 1.0
            }
        },
        format: {
            codec: 'libmp3lame',
            bitrate: '192k'
        }
    }
}; 