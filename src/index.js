import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import gTTS from 'node-gtts';
import playSound from 'play-sound';
import ffmpeg from 'fluent-ffmpeg';

const player = playSound();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, '../output');

class ArticlePodcastGenerator {
    constructor() {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }

    async generateWithOllama(prompt) {
        console.log('Sending prompt to Ollama:', prompt);
        try {
            if (!prompt) {
                throw new Error('Empty prompt');
            }

            // Check if Ollama is running
            try {
                await fetch('http://localhost:11434/');
            } catch (error) {
                throw new Error('Ollama server is not running. Start it with: ollama serve');
            }

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'mistral',
                    prompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9,
                        num_predict: 2048,
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama API error: ${error}`);
            }

            const data = await response.json();
            console.log('Raw Ollama response:', data);
            
            if (!data.response) {
                throw new Error('No response from Ollama API');
            }

            return data.response;
        } catch (error) {
            console.error('Ollama API error:', error);
            throw error;
        }
    }

    async extractText(filePath) {
        const extension = path.extname(filePath).toLowerCase();
        
        switch (extension) {
            case '.pdf':
                return new Promise((resolve, reject) => {
                    const pdfParser = new PDFParser();
                    pdfParser.on("pdfParser_dataReady", (pdfData) => {
                        const text = decodeURIComponent(pdfData.Pages.map(page => 
                            page.Texts.map(text => text.R.map(r => r.T).join(' ')).join(' ')
                        ).join('\n'));
                        resolve(text);
                    });
                    pdfParser.on("pdfParser_dataError", reject);
                    pdfParser.loadPDF(filePath);
                });
            
            case '.doc':
            case '.docx':
                const docBuffer = fs.readFileSync(filePath);
                const result = await mammoth.extractRawText({ buffer: docBuffer });
                return result.value;
            
            case '.txt':
                return fs.readFileSync(filePath, 'utf8');
            
            default:
                throw new Error('Unsupported file format');
        }
    }

    async generateDiscussion(articleText) {
        try {
            const prompt = `
            Convert this technical article into a podcast interview format between:
            Host: A tech podcast host named Alex who asks insightful questions
            Guest: A software engineer named Sarah who explains technical concepts clearly
            
            Make sure each line starts with either "Alex:" or "Sarah:" to indicate who is speaking.
            
            The host (Alex) should:
            - Ask engaging questions
            - Guide the conversation
            - Occasionally summarize key points
            - Help break down complex topics for the audience
            
            The guest (Sarah) should:
            - Provide detailed technical explanations
            - Share real-world examples and experiences
            - Break down complex concepts into understandable parts
            
            Format the conversation exactly like this:
            Alex: Welcome to Tech Deep Dive! Today we're joined by Sarah, a senior software engineer, to discuss an interesting topic. Sarah, can you tell us about...
            Sarah: Thanks for having me, Alex. This is a fascinating topic because...
            
            Article:
            ${articleText}
            
            Generate the podcast interview:`;

            const response = await this.generateWithOllama(prompt);
            if (!response) {
                throw new Error('No response from Ollama');
            }

            console.log('Generated discussion:', response);
            
            // Ensure the response has the correct format
            if (!response.includes('Alex:') && !response.includes('Sarah:')) {
                console.log('Response does not contain speaker prefixes, reformatting...');
                const lines = response.split('\n');
                console.log('Original lines:', lines);
                const formattedLines = lines.map((line, index) => {
                    if (!line.trim()) return '';
                    const formattedLine = `${index % 2 === 0 ? 'Alex:' : 'Sarah:'} ${line}`;
                    console.log('Formatted line:', formattedLine);
                    return formattedLine;
                });
                const result = formattedLines.join('\n');
                console.log('Reformatted discussion:', result);
                return result;
            }

            return response;
        } catch (error) {
            console.error('Error in generateDiscussion:', error);
            throw error;
        }
    }

    async convertToSpeech(discussion) {
        console.log('Converting discussion to speech:', discussion);
        const speakers = {
            alex: new gTTS('en-uk', { speed: 1.0 }),
            sarah: new gTTS('en-us', { speed: 1.0 })
        };

        const lines = discussion.split('\n');
        console.log('Split lines:', lines);

        // Clean and normalize the lines
        const cleanedLines = lines
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Normalize "Alex:" and "Sarah:" prefixes
                line = line.replace(/^Alex\s*:\s*/i, 'Alex: ');
                line = line.replace(/^Sarah\s*:\s*/i, 'Sarah: ');
                return line;
            });
        
        console.log('Cleaned lines:', cleanedLines);

        const audioFiles = [];

        for (const line of cleanedLines) {
            if (!line.trim()) continue; // Skip empty lines

            
            console.log('Processing line:', line);
            try {
                if (line.startsWith('Alex:')) {
                    console.log('Found Alex line:', line);
                    const text = line.replace('Alex:', '').trim();
                    console.log('Alex text to speak:', text);
                    const outputFile = path.join(outputDir, `temp_alex_${Date.now()}.mp3`);
                    await new Promise((resolve, reject) => {
                        speakers.alex.save(outputFile, text, (err) => {
                            if (err) {
                                console.error('Error saving Alex audio:', err);
                                reject(err);
                            } else resolve();
                        });
                    });
                    audioFiles.push(outputFile);
                } else if (line.startsWith('Sarah:')) {
                    console.log('Found Sarah line:', line);
                    const text = line.replace('Sarah:', '').trim();
                    console.log('Sarah text to speak:', text);
                    const outputFile = path.join(outputDir, `temp_sarah_${Date.now()}.mp3`);
                    await new Promise((resolve, reject) => {
                        speakers.sarah.save(outputFile, text, (err) => {
                            if (err) {
                                console.error('Error saving Sarah audio:', err);
                                reject(err);
                            } else resolve();
                        });
                    });
                    audioFiles.push(outputFile);
                } else {
                    console.log('Line does not start with Alex: or Sarah:', line);
                }
            } catch (error) {
                console.error('Error converting line to speech:', line, error);
            }
        }

        console.log('Generated audio files:', audioFiles);
        if (audioFiles.length === 0) {
            throw new Error('No audio files were generated');
        }

        return audioFiles;
    }

    async combineAudioFiles(audioFiles) {
        if (!audioFiles.length) {
            throw new Error('No audio files to combine');
        }

        const outputFile = path.join(outputDir, `podcast_${Date.now()}.mp3`);
        
        return new Promise((resolve, reject) => {
            let command = ffmpeg(audioFiles[0]);
            
            if (audioFiles.length > 1) {
                const inputs = audioFiles.slice(1);
                inputs.forEach(file => {
                    command.input(file);
                });

                const filterComplex = audioFiles
                    .map((_, index) => `[${index}:0]`)
                    .join('') + 
                    `concat=n=${audioFiles.length}:v=0:a=1[out]`;
                
                command.complexFilter(filterComplex, ['out']);
            }
            
            command
                .outputOptions('-acodec libmp3lame')
                .outputOptions('-ab 192k')
                .on('error', (err) => {
                    console.error('Error combining audio files:', err);
                    reject(err);
                })
                .on('end', () => {
                    // Clean up temporary files
                    audioFiles.forEach(file => {
                        try {
                            fs.unlinkSync(file);
                        } catch (error) {
                            console.error('Error deleting temp file:', error);
                        }
                    });
                    resolve(outputFile);
                })
                .save(outputFile);
        });
    }

    async generate(inputFile) {
        try {
            console.log('Starting podcast generation...');
            
            console.log('Input file:', inputFile);
            const articleText = await this.extractText(inputFile);
            console.log('Extracted text length:', articleText.length);
            console.log('Generating discussion...');
            const discussion = await this.generateDiscussion(articleText);
            console.log('Generated discussion length:', discussion.length);
            
            console.log('Converting to speech...');
            const audioFiles = await this.convertToSpeech(discussion);
            console.log('Generated audio files:', audioFiles);
            
            console.log('Combining audio files...');
            const outputFile = await this.combineAudioFiles(audioFiles);
            console.log('Final output file:', outputFile);
            
            console.log('Podcast generation completed successfully!');
            return outputFile;
        } catch (error) {
            console.error('Error generating podcast:', {
                error: error.message,
                stack: error.stack,
                phase: error.phase || 'unknown'
            });
            throw error;
        }
    }

    async generateSummary(filePath) {
        const text = await this.extractText(filePath);
        const prompt = `
            Analyze the following technical content and provide a structured summary with these sections:
            1. Key Points: Main concepts and ideas (3-5 bullet points)
            2. Technical Details: Important technical specifications or requirements
            3. Implementation Notes: Practical considerations and best practices
            4. Code Examples: If there are any code snippets, format them properly
            
            Format the response in JSON with these keys: keyPoints, technicalDetails, implementationNotes, codeExamples
            Make it detailed but concise, targeting software engineers.
            
            Content to analyze:
            ${text}
        `;

        const response = await this.generateWithOllama(prompt);
        try {
            return JSON.parse(response);
        } catch (error) {
            console.error('Error parsing summary JSON:', error);
            return {
                keyPoints: ['Error generating structured summary'],
                technicalDetails: [],
                implementationNotes: [],
                codeExamples: null
            };
        }
    }

    async generateFromText(text) {
        try {
            console.log('Starting podcast generation from text...');
            
            console.log('Generating discussion...');
            const discussion = await this.generateDiscussion(text);
            console.log('Generated discussion length:', discussion.length);
            
            console.log('Converting to speech...');
            const audioFiles = await this.convertToSpeech(discussion);
            console.log('Generated audio files:', audioFiles);
            
            console.log('Combining audio files...');
            const outputFile = await this.combineAudioFiles(audioFiles);
            console.log('Final output file:', outputFile);
            
            console.log('Podcast generation completed successfully!');
            return outputFile;
        } catch (error) {
            console.error('Error generating podcast:', error);
            throw error;
        }
    }

    async generateSummaryFromText(text) {
        const prompt = `
            Please analyze the following content and create a structured summary in valid JSON format.
            Use exactly this JSON structure:
            {
                "keyPoints": ["point 1", "point 2", "point 3"],
                "importantDetails": ["detail 1", "detail 2"],
                "additionalNotes": ["note 1", "note 2"],
                "notableQuotes": ["quote 1", "quote 2"]
            }
            
            Guidelines:
            - Key Points: 3-5 main ideas or concepts
            - Important Details: 2-4 significant pieces of information
            - Additional Notes: 2-3 relevant contextual notes
            - Notable Quotes: Any significant quotes (can be empty array if none)
            
            Ensure the response is ONLY the JSON object, no additional text.
            
            Content to analyze:
            ${text}
        `;

        const response = await this.generateWithOllama(prompt);
        try {
            // Clean the response to ensure it's valid JSON
            const cleanedResponse = response.trim()
                .replace(/```json/g, '')  // Remove any markdown code block indicators
                .replace(/```/g, '')      // Remove any markdown code block indicators
                .trim();

            console.log('Cleaned response:', cleanedResponse);

            const parsedResponse = JSON.parse(cleanedResponse);

            // Validate the structure
            if (!parsedResponse.keyPoints || !Array.isArray(parsedResponse.keyPoints)) {
                throw new Error('Invalid summary structure');
            }

            return parsedResponse;
        } catch (error) {
            console.error('Error parsing summary JSON:', error);
            console.error('Raw response:', response);
            return {
                keyPoints: ['Could not generate summary. Please try again.'],
                importantDetails: [],
                additionalNotes: [],
                notableQuotes: null
            };
        }
    }
}

export { ArticlePodcastGenerator };