export default {
    llm: {
        modelPath: '../models/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
        contextSize: 4096,
        temperature: 0.7,
        topP: 0.9
    },
    audio: {
        outputDir: '../output',
        tempDir: '../temp'
    }
}; 