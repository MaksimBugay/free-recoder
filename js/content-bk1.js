let mediaRecorder;
const chunkInterval = 10000; // 10 seconds
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

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        mediaRecorder = new MediaRecorder(stream, {mimeType: 'video/webm'});

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                const blob = new Blob([event.data], {type: 'video/webm'});
                const url = URL.createObjectURL(blob);
                const filename = `recording_chunk_${Date.now()}.webm`;

                chunks.push(url);
                console.log(`${chunks.length} chunks were recorded`);
            }
        };

        mediaRecorder.start(chunkInterval);
        return {status: 0, message: 'recording started'};
    } catch (err) {
        return {status: -1, message: `Cannot start, error accessing media devices: ${err}`};
    }
}

function stopRecording() {
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

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
