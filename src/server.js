import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { ArticlePodcastGenerator } from './index.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, '../output')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/test-ollama', async (req, res) => {
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'mistral',
                prompt: 'Say hello',
                stream: false
            })
        });
        const data = await response.json();
        res.json({ success: true, response: data });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message,
            details: 'Make sure Ollama is running with: ollama serve'
        });
    }
});

app.post('/upload', upload.single('article'), express.json(), async (req, res) => {
    try {
        let text;
        if (req.file) {
            // Handle file upload
            const generator = new ArticlePodcastGenerator();
            text = await generator.extractText(req.file.path);
        } else if (req.body.text) {
            // Handle pasted text
            text = req.body.text;
        } else {
            return res.status(400).json({ error: 'Please provide either a file or text content' });
        }

        const generator = new ArticlePodcastGenerator();
        console.log('Starting conversion for content');
        const summary = await generator.generateSummaryFromText(text);
        const outputFile = await generator.generateFromText(text);
        console.log('Generated output file:', outputFile);
        
        // Get the filename only from the full path
        const filename = path.basename(outputFile);
        
        res.json({
            success: true,
            message: 'Podcast generated successfully',
            audioFile: `/output/${filename}`,
            filename: filename,
            summary: summary
        });
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error',
            details: error.stack
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 