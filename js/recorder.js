const mimeType = 'video/webm; codecs="vp9"';
const chunks = [];
const chunkInterval = 5000;

try {
    if (MediaSource.isTypeSupported(mimeType)) {
        console.log(`Browser supports ${mimeType} for MediaSource`);
    } else {
        throw new Error(`Browser does not support ${mimeType} for MediaSource`);
    }

    if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Browser supports ${mimeType} for MediaRecorder`);
    } else {
        throw new Error(`Browser does not support ${mimeType} for MediaRecorder`);
    }

    const startButton = document.getElementById("startBtn");
    const stopButton = document.getElementById("stopBtn");
    startButton.addEventListener('click', function (event) {
        startRecording().then(result => {
            if (result.status === 0) {
                startButton.disabled = true;
                stopButton.disabled = false;
            }
        });
    });
    stopButton.addEventListener('click', function (event) {
        const result = stopRecording();
        if (result.status === 0) {
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    })
} catch (error) {
    console.error("An error occurred:", error);
}

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

function stopRecording() {
    try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        delay(100).then(() => {
            //saveRecording();
            playRecording();
        })
        return {status: 0, message: 'recording stopped'};
    } catch (err) {
        return {status: -1, message: `Cannot stop, error accessing media devices: ${err}`};
    }
}

function playRecording() {
    const combinedBlob = new Blob(chunks, {type: mimeType});
    const videoPlayer = document.getElementById("videoPlayer");
    const url = URL.createObjectURL(combinedBlob);
    videoPlayer.src = url;

    videoPlayer.addEventListener('ended', function () {
        URL.revokeObjectURL(url);
        console.log('Video ended');
    });

    videoPlayer.addEventListener('error', function () {
        URL.revokeObjectURL(url);
        console.error('An error occurred during video playback');
    });

    videoPlayer.play();
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