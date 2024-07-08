let mediaRecorder;
let stream;
const chunkInterval = 10000; // 10 seconds
let recording = false;
const chunks = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startRecording') {
        startRecording(sendResponse).then(result => {
            sendResponse(result);
        });
        return true; // Keeps the message channel open for asynchronous sendResponse
    }
    if (message.action === 'stopRecording') {
        const result = stopRecording();
        sendResponse(result);
        return true; // Keeps the message channel open for asynchronous sendResponse
    }
    if (message.action === 'getNextChunkUrl') {
        URL.revokeObjectURL(message.finishedVideoUrl);
        if (chunks.length > 0) {
            sendResponse({url: chunks.shift()});
        } else {
            sendResponse({url: null});
        }
    }
});

async function startRecording(sendResponse) {
    try {
        stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        recording = true;
        recordChunk();
        return {status: 0, message: 'recording started'};
    } catch (err) {
        return {status: -1, message: `Cannot start, error accessing media devices: ${err}`};
    }
}

function recordChunk() {
    if (!recording) return;

    mediaRecorder = new MediaRecorder(stream, {mimeType: 'video/webm'});

    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
            const blob = new Blob([event.data], {type: 'video/webm'});
            const url = URL.createObjectURL(blob);
            const filename = `recording_chunk_${Date.now()}.webm`;

            /*chrome.runtime.sendMessage({action: 'saveChunk', url, filename}, (response) => {
                console.log(response.status);
                URL.revokeObjectURL(url);
            });*/
            chunks.push(url);
            console.log(`${chunks.length} chunks were recorded`);
        }
    };

    mediaRecorder.onstop = () => {
        if (recording) {
            setTimeout(recordChunk, 100); // Slight delay before starting the next chunk
        } else {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    mediaRecorder.start();
    setTimeout(() => {
        mediaRecorder.stop();
    }, chunkInterval);
}

function stopRecording() {
    recording = false;
    try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (chunks.length > 0) {
            const url = chunks.shift();
            chrome.runtime.sendMessage({action: 'playChunk', url});
        }
        return {status: 0, message: 'recording stopped'};
    } catch (err) {
        return {status: -1, message: `Cannot stop, error accessing media devices: ${err}`};
    }
}
