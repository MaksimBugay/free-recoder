const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'

const wsUrl = 'wss://vasilii.prodpushca.com:30085/';
let pingIntervalId = null;
const pClient = {
    workSpaceId: "media-stream-test",
    accountId: "player-demo",
    deviceId: "web-page-edge",
    applicationId: "player"
};
const clientHashCode = calculateClientHashCode(
    pClient.workSpaceId,
    pClient.accountId,
    pClient.deviceId,
    pClient.applicationId
);
const binaryId = uuid.v4();
const binaryType = BinaryType.MEDIA_STREAM;
const withAcknowledge = false;

let mediaRecorder;
const chunks = [];


if (!PushcaClient.isOpen()) {
    PushcaClient.openWsConnection(
        wsUrl,
        new ClientFilter(
            "media-stream-test",
            "player-demo",
            "web-page-edge2",
            "recoder"
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
        }
    });
});
stopButton.addEventListener('click', function (event) {
    const result = stopRecording();
    if (result.status === 0) {
        startButton.disabled = false;
        stopButton.disabled = true;
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        mediaRecorder = new MediaRecorder(stream, {mimeType: mimeType});

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                const blob = event.data;
                chunks.push(blob);
                console.log(`${chunks.length} chunks were recorded`);
                uploadLastChunk();
            }
        };

        mediaRecorder.start(5000);
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
        delay(5000).then(() => {
            /*saveRecording(1);
            saveRecording(2);
            saveRecording(3);*/
            chunks.splice(0, chunks.length);//clean memory
        })
        return {status: 0, message: 'recording stopped'};
    } catch (err) {
        return {status: -1, message: `Cannot stop, error accessing media devices: ${err}`};
    }
}

function uploadLastChunk() {
    if (chunks.length < 1) {
        return;
    }
    const order = chunks.length - 1;
    const chunkBlob = (chunks.length === 1) ? new Blob([chunks[0]], {type: mimeType}) : new Blob([chunks[0], chunks[order]], {type: mimeType});
    convertBlobToArrayBuffer(chunkBlob).then((arrayBuffer) => {
        let customHeader = buildPushcaBinaryHeader(
            binaryType, clientHashCode, withAcknowledge, binaryId, order
        );
        const combinedBuffer = new ArrayBuffer(customHeader.length + arrayBuffer.byteLength);
        const combinedView = new Uint8Array(combinedBuffer);
        combinedView.set(customHeader, 0);
        combinedView.set(new Uint8Array(arrayBuffer), customHeader.length);

        if (PushcaClient.isOpen()) {
            PushcaClient.ws.send(combinedBuffer);
            console.log(`Segment ${order} was sent`);
        }
    }).catch((error) => {
        console.error("Error converting Blob to Uint8Array:", error);
    });
}

function saveRecordedChunk(chunkIndex) {
    console.log(`Chunks number = ${chunks.length}`);
    const blob = new Blob([chunks[0], chunks[chunkIndex]], {type: mimeType});
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