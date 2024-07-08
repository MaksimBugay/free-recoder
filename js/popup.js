const videoPlayer = document.getElementById('videoPlayer');
document.getElementById('startBtn').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'startRecording'}, (response) => {
            console.log(response);
            if (response.status === 0) {
                document.getElementById('startBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;
            }
        });
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'stopRecording'}, (response) => {
            console.log(response);
            if (response.status === 0) {
                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
            }
        });
    });
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'playChunk') {
        playVideo(message.url);
        return true; // Keeps the message channel open for asynchronous sendResponse
    }
});

function playNextChunk() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'getNextChunkUrl',
            finishedVideoUrl: videoPlayer.src
        }, (response) => {
            console.log("Get next chunk response");
            console.log(response);
            if (response.url) {
                try {
                    playVideo(response.url);
                } catch (err) {
                    console.error("Failed to play video attempt: " + err);
                }
            }
        });
    });
}

function playVideo(blobUrl) {
    if (blobUrl) {
        videoPlayer.src = blobUrl;
        videoPlayer.play();
    }
}

videoPlayer.addEventListener('ended', function () {
    playNextChunk();
});