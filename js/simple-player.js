const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'

const wsUrl = 'wss://vasilii.prodpushca.com:30085/';
let pingIntervalId = null;

const pRecorderClient = new ClientFilter(
    "media-stream-test",
    "player-demo",
    "web-page-edge",
    "recorder"
);

const video = document.getElementById('videoPlayer');
const mediaSource = new MediaSource();
let sourceBuffer;
let queue = [];
let segmentCounter = 0;

function appendNextChunk() {
    if (queue.length > 0 && !sourceBuffer.updating) {
        try {
            const chunk = queue.shift();
            console.log('Appending chunk of size:', chunk.byteLength);
            sourceBuffer.appendBuffer(chunk);
        } catch (err) {
            console.error('Error appending buffer:', err);
        }
    } else if (queue.length === 0 && video.paused && mediaSource.readyState === 'open') {
        video.play();
    }
}

function fetchAndQueueChunk(chunk) {
    queue.push(chunk);
    appendNextChunk();
}

document.getElementById('playBtn').addEventListener('click', () => {
    activatePlayer();
});

function activatePlayer() {
    if (!video.src) {
        console.log("Player was activated");
        video.src = URL.createObjectURL(mediaSource);
    }
}

//document.addEventListener('mousemove', activatePlayer);
//document.addEventListener('touchstart', activatePlayer);

mediaSource.addEventListener('sourceopen', function () {
        sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        sourceBuffer.mode = 'sequence';

        sourceBuffer.addEventListener('updateend', function () {
            segmentCounter += 1;
            appendNextChunk();
            if (video.paused) {
                video.play();
            }
        });

        sourceBuffer.addEventListener('error', function (e) {
            console.error('SourceBuffer error:', e);
        });
    }
);

if (!PushcaClient.isOpen()) {
    PushcaClient.openWsConnection(
        wsUrl,
        new ClientFilter(
            "media-stream-test",
            "player-demo",
            "web-page-edge",
            "player"
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
            if (messageText === "ms_start") {
                console.log("Realtime Media stream was started");
            }
            if (messageText === "ms_stop") {
                console.log("Realtime Media stream was stopped");
                delay(10000).then(() => {
                    //location.replace(location.href);
                });
            }
        },
        function (channelEvent) {
            //console.log(channelEvent);
        },
        function (channelMessage) {
            //console.log(channelMessage);
        },
        function (binary) {
            const order = extractOrderFromBinaryWithHeader(binary);
            const data = copyBytes(binary, 26, binary.byteLength);
            //chunks.push(data);
            fetchAndQueueChunk(data);
            PushcaClient.broadcastMessage(uuid.v4(), pRecorderClient, false, `ms_get_next_chunk_${order + 1}`);
            console.log(`${order} chunk just arrived: ${binary.byteLength}`);
        }
    );
}