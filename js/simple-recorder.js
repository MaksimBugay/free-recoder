const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'

const wsUrl = 'wss://vasilii.prodpushca.com:30085/';
let pingIntervalId = null;
const pPlayerClient = new ClientFilter(
    "media-stream-test",
    "player-demo",
    "web-page-edge",
    "player"
);
const playerClientHashCode = calculateClientHashCode(
    pPlayerClient.workSpaceId,
    pPlayerClient.accountId,
    pPlayerClient.deviceId,
    pPlayerClient.applicationId
);
const binaryId = uuid.v4();
const binaryType = BinaryType.MEDIA_STREAM;
const withAcknowledge = false;

let mediaRecorder;

let chunkCounter = 0;
let firstChunk = null;
const chunks = new Map();


if (!PushcaClient.isOpen()) {
    PushcaClient.openWsConnection(
        wsUrl,
        new ClientFilter(
            "media-stream-test",
            "player-demo",
            "web-page-edge",
            "recorder"
        ),
        function () {
            pingIntervalId = window.setInterval(function () {
                PushcaClient.sendPing();
            }, 30000);
        },
        function (ws, event) {
            window.clearInterval(pingIntervalId);
            if (!event.wasClean) {
                console.error("Your connection died, refresh the page please");
            }
        },
        function (ws, messageText) {
            if (messageText !== "PONG") {
                console.log(messageText);
            }
            if (messageText.includes("ms_get_next_chunk_")) {
                const order = extractNumber(messageText);
                uploadChunk(order);
            }
        },
        function (channelEvent) {
            //console.log(channelEvent);
        },
        function (channelMessage) {
            //console.log(channelMessage);
        },
        function (binary) {
            //console.log(binary.length)
        }
    );
}
const startButton = document.getElementById("startBtn");
const stopButton = document.getElementById("stopBtn");
startButton.addEventListener('click', function (event) {
    startRecording().then(result => {
        if (result.status === 0) {
            startButton.disabled = true;
            stopButton.disabled = false;
            PushcaClient.broadcastMessage(uuid.v4(), pPlayerClient, false, "ms_start");
        }
    });
});
stopButton.addEventListener('click', function (event) {
    PushcaClient.broadcastMessage(uuid.v4(), pPlayerClient, false, "ms_stop");
    stopRecording().then(result => {
        if (result.status === 0) {
            startButton.disabled = false;
            stopButton.disabled = true;
        }
        location.replace(location.href);
    });
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        mediaRecorder = new MediaRecorder(stream, {mimeType: mimeType});

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                const blob = event.data;
                chunkCounter += 1;
                if (firstChunk) {
                    chunks.set(chunkCounter, blob);
                    if (chunkCounter === 2) {
                        uploadChunk(2);
                    }
                } else {
                    firstChunk = blob;
                }

                console.log(`${chunkCounter} chunks were recorded`);
            }
        };

        mediaRecorder.start(5000);
        return {status: 0, message: 'recording started'};
    } catch (err) {
        return {status: -1, message: `Cannot start, error accessing media devices: ${err}`};
    }
}

async function stopRecording() {
    try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        await delay(2000);
        chunks.clear();
        return {status: 0, message: 'recording stopped'};
    } catch (err) {
        return {status: -1, message: `Cannot stop, error accessing media devices: ${err}`};
    }
}

function uploadChunk(index) {
    const blob = chunks.get(index);
    if (!blob) {
        return;
    }
    const order = index - 1;
    const chunkBlob = new Blob([firstChunk, blob], {type: mimeType});
    convertBlobToArrayBuffer(chunkBlob).then((arrayBuffer) => {
        let customHeader = buildPushcaBinaryHeader(
            binaryType, playerClientHashCode, withAcknowledge, binaryId, order
        );
        const combinedBuffer = new ArrayBuffer(customHeader.length + arrayBuffer.byteLength);
        const combinedView = new Uint8Array(combinedBuffer);
        combinedView.set(customHeader, 0);
        combinedView.set(new Uint8Array(arrayBuffer), customHeader.length);

        if (PushcaClient.isOpen()) {
            PushcaClient.ws.send(combinedBuffer);
            console.log(`Segment ${order} was sent`);
            chunks.delete(index);
        }
    }).catch((error) => {
        console.error("Error converting Blob to Uint8Array:", error);
    });
}

function saveRecordedChunk(chunkIndex) {
    console.log(`Chunks number = ${chunkCounter}`);
    const blob = new Blob([firstChunk, chunks.get(chunkIndex)], {type: mimeType});
    convertBlobToArrayBuffer(blob).then((arrayBuffer) => {
        const customHeader = [];
        const combinedBuffer = new ArrayBuffer(customHeader.length + arrayBuffer.byteLength);
        const combinedView = new Uint8Array(combinedBuffer);
        combinedView.set(customHeader, 0);
        combinedView.set(new Uint8Array(arrayBuffer), customHeader.length);

        const combinedBlob = new Blob([combinedView], {type: mimeType});
        const url = URL.createObjectURL(combinedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `recorded_video_${chunkIndex}.mp4`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
    }).catch((error) => {
        console.error("Error converting Blob to Uint8Array:", error);
    });
}