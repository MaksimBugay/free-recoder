const videoMimeTypes = [
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/webm; codecs="vp9"',
    /*'video/webm; codecs="vp8,vorbis"',
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4;codecs="avc1.42001f,opus"',
    'video/ogg; codecs="theora,vorbis"',*/
    'video/x-matroska;codecs="avc1,opus"'
];

for (const mimeType of videoMimeTypes) {
    if (MediaSource.isTypeSupported(mimeType)) {
        console.log(`Browser supports ${mimeType} for MediaSource`);
    } else {
        console.log(`Browser does not support ${mimeType} for MediaSource`);
    }

    if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Browser supports ${mimeType} for MediaRecorder`);
    } else {
        console.log(`Browser does not support ${mimeType} for MediaRecorder`);
    }
}

const mimeType = videoMimeTypes[1];

const videoPlayer = document.createElement('video');
videoPlayer.id = 'vPlayer';
videoPlayer.style.position = 'absolute';
videoPlayer.style.width = "500px";
videoPlayer.style.height = "300px";
videoPlayer.style.top = '20px';
videoPlayer.style.zIndex = '99999';
document.body.appendChild(videoPlayer);
videoPlayer.controls = true;

let mediaSource = null;
let sourceBuffer = null;

let mediaRecorder;
const chunkInterval = 5000; // 5 seconds
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
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        mediaRecorder = new MediaRecorder(stream, {mimeType: mimeType});

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                const blob = event.data;
                console.log('Blob type:', blob.type);

                chunks.push(blob);
                console.log(`${chunks.length} chunks were recorded`);
            }
        };

        mediaRecorder.start(chunkInterval);
        return {status: 0, message: 'recording started'};
    } catch (err) {
        return {status: -1, message: `Cannot start, error accessing media devices: ${err}`};
    }
}


function playRecording() {
    mediaSource = new MediaSource();
    videoPlayer.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => {
        sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        sourceBuffer.mode = 'sequence';
        sourceBuffer.addEventListener('error', (e) => {
            console.error('SourceBuffer error:', e);
        });
        appendNextChunk();
    });
    mediaSource.addEventListener('error', (e) => {
        console.error('MediaSource error:', e);
    });
    mediaSource.addEventListener('sourceended', () => {
        console.log('MediaSource ended');
    });
    videoPlayer.play();
}

function appendNextChunk() {
    console.log("Append next chunk request");
    if (chunks.length === 0) {
        mediaSource.endOfStream();
        return;
    }

    if (!sourceBuffer.updating) {
        const chunk = chunks.shift();
        chunk.arrayBuffer().then(buffer => {
            try {
                sourceBuffer.appendBuffer(buffer);
                console.log('Chunk appended');
                //appendNextChunk(); // Append the next chunk
            } catch (e) {
                console.error('Failed to append buffer:', e);
            }
        }).catch(error => {
            console.error('Failed to convert blob to arrayBuffer:', error);
        });
    } else {
        sourceBuffer.addEventListener('updateend', appendNextChunk, {once: true});
    }
}

function convertBlobToUint8Array(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function () {
            const arrayBuffer = reader.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            resolve(uint8Array);
        };
        reader.onerror = function (error) {
            reject(error);
        };
        reader.readAsArrayBuffer(blob);
    });
}

function saveRecording() {
    console.log(`Chunks number = ${chunks.length}`);
    let blob = new Blob(chunks, {type: mimeType});
    convertBlobToUint8Array(blob).then((uint8Array) => {
        let customHeader = new Uint8Array([]);
        let combinedArray = new Uint8Array(customHeader.length + uint8Array.length);
        combinedArray.set(customHeader);
        combinedArray.set(uint8Array, customHeader.length);

        const combinedBlob = new Blob([combinedArray], {type: mimeType});
        const url = URL.createObjectURL(combinedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'recorded_video_with_header.webm';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
    }).catch((error) => {
        console.error("Error converting Blob to Uint8Array:", error);
    });
}

function stopRecording() {
    try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        delay(100).then(() => {
            saveRecording();
        })
        /*if (chunks.length > 0) {
            const firstChunk = chunks.shift();
            console.log('First chunk blob type:', firstChunk.type);
            //playRecording();
            videoPlayer.src = URL.createObjectURL(firstChunk);
        }*/
        return {status: 0, message: 'recording stopped'};
    } catch (err) {
        return {status: -1, message: `Cannot stop, error accessing media devices: ${err}`};
    }
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

//==========================Pushca header builder============================================

