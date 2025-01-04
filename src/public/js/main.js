document.querySelectorAll(".drop-zone__input").forEach((inputElement) => {
    const dropZoneElement = inputElement.closest(".drop-zone");

    dropZoneElement.addEventListener("click", (e) => {
        if (e.target.closest('.file-info')) return;
        inputElement.click();
    });

    inputElement.addEventListener("change", (e) => {
        if (inputElement.files.length) {
            updateThumbnail(dropZoneElement, inputElement.files[0]);
        }
    });

    dropZoneElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZoneElement.classList.add("drop-zone--over");
    });

    ["dragleave", "dragend"].forEach((type) => {
        dropZoneElement.addEventListener(type, (e) => {
            dropZoneElement.classList.remove("drop-zone--over");
        });
    });

    dropZoneElement.addEventListener("drop", (e) => {
        e.preventDefault();

        if (e.dataTransfer.files.length) {
            inputElement.files = e.dataTransfer.files;
            updateThumbnail(dropZoneElement, e.dataTransfer.files[0]);
        }

        dropZoneElement.classList.remove("drop-zone--over");
    });
});

function updateThumbnail(dropZoneElement, file) {
    const promptElement = dropZoneElement.querySelector(".drop-zone__prompt");
    const fileInfo = dropZoneElement.querySelector(".file-info") || 
                    document.createElement("div");
    const fileName = fileInfo.querySelector(".file-name") || 
                    document.createElement("span");

    fileInfo.className = "file-info";
    fileName.className = "file-name";
    fileName.textContent = file.name;

    if (!fileInfo.querySelector(".file-name")) {
        fileInfo.appendChild(fileName);
    }

    promptElement.innerHTML = `
        <span class="text-gray-900 font-medium">${file.name}</span>
        <p class="text-xs text-gray-500 mt-1">Click to change file</p>
    `;
    if (!dropZoneElement.querySelector(".file-info")) {
        dropZoneElement.appendChild(fileInfo);
    }
}

function updateProgress(progress) {
    const progressBar = document.querySelector('.progress-bar__fill');
    const progressText = document.querySelector('.progress-status');
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.querySelector('input[name="article"]');
    const textInput = document.querySelector('textarea[name="notes"]');
    const submitBtn = document.querySelector('.submit-btn');
    const progressContainer = document.querySelector('.progress-container');
    
    if (!fileInput.files[0] && (!textInput.value || textInput.value.trim() === '')) {
        const statusDiv = document.getElementById('status');
        statusDiv.innerHTML = `
            <div class="bg-red-50 text-red-700">
                <p>Please either upload a file or paste some text</p>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        return;
    }
    
    let requestBody;
    let requestOptions;
    
    if (fileInput.files[0]) {
        const formData = new FormData();
        formData.append('article', fileInput.files[0]);
        requestOptions = {
            method: 'POST',
            body: formData
        };
    } else {
        requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: textInput.value })
        };
    }
    
    const statusDiv = document.getElementById('status');
    const playerDiv = document.getElementById('player');
    const audioElement = playerDiv.querySelector('audio');
    const downloadBtn = document.getElementById('downloadBtn');
    
    try {
        // Update UI to loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        progressContainer.style.display = 'block';
        statusDiv.textContent = 'Converting document to podcast...';
        statusDiv.className = 'status';
        playerDiv.classList.add('hidden');
        
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) clearInterval(progressInterval);
            updateProgress(Math.min(progress, 90));
        }, 1000);

        const response = await fetch('/upload', requestOptions);
        
        clearInterval(progressInterval);
        const data = await response.json();
        
        if (data.success) {
            updateProgress(100);
            statusDiv.innerHTML = `
                <div class="bg-green-50 text-green-700">
                    <p>Conversion successful!</p>
                </div>
            `;
            
            audioElement.src = data.audioFile;
            downloadBtn.href = data.audioFile;
            playerDiv.classList.remove('hidden');
            
            // Display summary
            if (data.summary) {
                const summaryDiv = document.getElementById('summary');
                const keyPointsList = document.getElementById('key-points');
                const importantDetailsList = document.getElementById('important-details');
                const additionalNotesList = document.getElementById('additional-notes');
                const notableQuotesSection = document.getElementById('notable-quotes');
                
                // Validate summary data
                if (!Array.isArray(data.summary.keyPoints) || data.summary.keyPoints.length === 0) {
                    console.error('Invalid or empty summary data');
                    return;
                }
                
                // Clear previous content
                keyPointsList.innerHTML = '';
                importantDetailsList.innerHTML = '';
                additionalNotesList.innerHTML = '';
                
                // Add Key Points
                data.summary.keyPoints.forEach(point => {
                    if (point && point.trim()) {  // Only add non-empty points
                        keyPointsList.innerHTML += `<li>${point}</li>`;
                    }
                });
                
                // Add Important Details
                (data.summary.importantDetails || []).forEach(detail => {
                    if (detail && detail.trim()) {
                        importantDetailsList.innerHTML += `<li>${detail}</li>`;
                    }
                });
                
                // Add Additional Notes
                (data.summary.additionalNotes || []).forEach(note => {
                    if (note && note.trim()) {
                        additionalNotesList.innerHTML += `<li>${note}</li>`;
                    }
                });
                
                // Add Notable Quotes if they exist
                if (data.summary.notableQuotes) {
                    notableQuotesSection.classList.remove('hidden');
                    notableQuotesSection.querySelector('.quotes-content').textContent = 
                        Array.isArray(data.summary.notableQuotes) 
                            ? data.summary.notableQuotes.join('\n\n')
                            : data.summary.notableQuotes;
                } else {
                    notableQuotesSection.classList.add('hidden');
                }
                
                summaryDiv.classList.remove('hidden');
            }
        } else {
            throw new Error(data.message || data.details || 'Conversion failed');
        }
    } catch (error) {
        console.error('Conversion error:', error);
        statusDiv.innerHTML = `
            <div class="bg-red-50 text-red-700">
                <p>Error: ${error.message}</p>
            </div>
        `;
        updateProgress(0);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Podcast';
    }
});

// New Note Button functionality
document.getElementById('newNoteBtn').addEventListener('click', () => {
    // Reset form inputs
    const fileInput = document.querySelector('input[name="article"]');
    const textInput = document.querySelector('textarea[name="notes"]');
    const dropZone = document.querySelector('.drop-zone');
    const submitBtn = document.querySelector('.submit-btn');
    
    // Reset file input
    fileInput.value = '';
    dropZone.querySelector('.drop-zone__prompt').innerHTML = 'Drop file here or click to upload';
    const fileInfo = dropZone.querySelector('.file-info');
    if (fileInfo) fileInfo.remove();
    
    // Reset text input
    textInput.value = '';
    
    // Reset UI elements
    document.getElementById('status').classList.add('hidden');
    document.getElementById('player').classList.add('hidden');
    document.getElementById('summary').classList.add('hidden');
    document.querySelector('.progress-container').style.display = 'none';
    document.querySelector('.progress-bar__fill').style.width = '0%';
    
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate Podcast';
    
    // Switch to file upload tab
    const fileTab = document.querySelector('[data-target="file-input"]');
    fileTab.click();
    
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
}); 