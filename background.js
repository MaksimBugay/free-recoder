chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveChunk') {
        saveChunk(message.url, message.filename, sendResponse);
        return true; // Keeps the message channel open for asynchronous sendResponse
    }
});

function saveChunk(url, filename, sendResponse) {
    chrome.downloads.download({
        url,
        filename, // Default filename without prompting the user
        conflictAction: 'uniquify' // Ensure unique filenames if the file already exists
    }, (downloadId) => {
        if (sendResponse) {
            sendResponse({ status: 'chunk saved', downloadId });
        }
    });
}
