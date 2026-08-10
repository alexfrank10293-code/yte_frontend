// ==========================================
// CONFIGURATION
// Change this to your Render URL when deployed
// Example: const API_BASE_URL = 'https://yte-backend.onrender.com';
// ==========================================
const API_BASE_URL = 'http://127.0.0.1:8000';

// DOM Elements
const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const loadingState = document.getElementById('loading-state');
const loadingText = document.getElementById('loading-text');
const errorState = document.getElementById('error-state');
const resultContainer = document.getElementById('result-container');
const videoThumbnail = document.getElementById('video-thumbnail');
const videoTitle = document.getElementById('video-title');
const videoUploader = document.getElementById('video-uploader');
const qualitiesGrid = document.getElementById('qualities-grid');
const downloadBtn = document.getElementById('download-btn');

let selectedFormatId = null;

// Helper to show errors
function showError(msg) {
    errorState.textContent = msg;
    errorState.classList.remove('hidden');
    setTimeout(() => {
        errorState.classList.add('hidden');
    }, 5000);
}

// Show/Hide Loading
function setLoading(isLoading, text = 'Fetching...') {
    if (isLoading) {
        loadingText.textContent = text;
        loadingState.classList.remove('hidden');
        fetchBtn.disabled = true;
        fetchBtn.style.opacity = '0.7';
    } else {
        loadingState.classList.add('hidden');
        fetchBtn.disabled = false;
        fetchBtn.style.opacity = '1';
    }
}

// Render Bento Grid Qualities
function renderQualities(formats) {
    qualitiesGrid.innerHTML = '';
    selectedFormatId = null;

    if (!formats || formats.length === 0) {
        qualitiesGrid.innerHTML = '<div class="col-span-full text-secondary">No suitable video formats found.</div>';
        return;
    }

    formats.forEach((format, index) => {
        // Calculate size in MB
        const sizeMB = format.filesize ? (format.filesize / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown Size';
        
        // Quality categorization (approximate)
        const height = parseInt(format.resolution.replace('p', ''));
        let label = 'SD';
        if (height >= 2160) label = '4K';
        else if (height >= 1440) label = '2K';
        else if (height >= 720) label = 'HD';

        // Create card
        const card = document.createElement('div');
        // Default styling for unselected card
        card.className = 'quality-card relative bg-surface rounded-xl p-4 border border-transparent hover:border-surface-variant cursor-pointer transition-hover hover:-translate-y-1';
        card.dataset.id = format.format_id;
        
        // Select check icon container
        const checkIcon = `
            <div class="check-icon absolute top-2 right-2 text-primary-container hidden">
                <span class="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
        `;

        card.innerHTML = `
            ${checkIcon}
            <div class="font-headline-md text-headline-md text-on-background mb-1">${format.resolution}</div>
            <div class="font-label-sm text-label-sm text-secondary">${label} / MP4</div>
            <div class="size-text mt-4 font-label-sm text-label-sm text-secondary">${sizeMB}</div>
        `;

        // Click Event for Selection
        card.addEventListener('click', () => {
            // Remove active state from all cards
            document.querySelectorAll('.quality-card').forEach(c => {
                c.classList.remove('border-primary-container');
                c.classList.add('border-transparent');
                c.querySelector('.check-icon').classList.add('hidden');
                c.querySelector('.size-text').classList.remove('text-primary', 'font-medium');
                c.querySelector('.size-text').classList.add('text-secondary');
            });

            // Add active state to this card
            card.classList.remove('border-transparent');
            card.classList.add('border-primary-container');
            card.querySelector('.check-icon').classList.remove('hidden');
            card.querySelector('.size-text').classList.remove('text-secondary');
            card.querySelector('.size-text').classList.add('text-primary', 'font-medium');
            
            selectedFormatId = format.format_id;
        });

        // Auto-select the first (best) quality
        if (index === 0) {
            card.click();
        }

        qualitiesGrid.appendChild(card);
    });
}

// Fetch Video Info
fetchBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        showError('Please enter a valid YouTube URL');
        return;
    }

    setLoading(true, 'Fetching video info...');
    resultContainer.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/fetch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to fetch video info');
        }

        const data = await response.json();
        
        // Populate UI
        videoTitle.textContent = data.title;
        videoUploader.textContent = data.uploader || 'YouTube Video';
        videoThumbnail.src = data.thumbnail;
        
        // Render Qualities Grid
        renderQualities(data.formats);

        resultContainer.classList.remove('hidden');
        // Scroll to result slightly
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
});

// Download Video
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();

    if (!selectedFormatId) {
        showError('Please select a video quality.');
        return;
    }

    setLoading(true, 'Downloading & converting... This may take a while.');
    const originalBtnText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = `<div class="spinner border-on-primary border-l-white border-[3px]"></div> Processing...`;
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.8';
    
    try {
        const response = await fetch(`${API_BASE_URL}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, format_id: selectedFormatId })
        });

        if (!response.ok) {
            let errorText = 'Failed to download video.';
            try {
                const err = await response.json();
                errorText = err.detail || errorText;
            } catch (e) {
                errorText = `HTTP Error ${response.status}`;
            }
            throw new Error(errorText);
        }

        // Handle binary stream response for automatic download
        setLoading(true, 'Saving file to your device...');
        const blob = await response.blob();
        
        // Extract filename from Content-Disposition header if possible
        let filename = 'video.mp4';
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
            const filenameMatch = disposition.match(/filename="?(.+)"?/);
            if (filenameMatch && filenameMatch.length >= 2) {
                filename = filenameMatch[1];
            }
        }

        // Create temporary download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
        downloadBtn.innerHTML = originalBtnText;
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
    }
});
