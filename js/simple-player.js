const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'

const wsUrl = 'wss://vasilii.prodpushca.com:30085/';
let pingIntervalId = null;
const pClient = {
    workSpaceId: "media-stream-test",
    accountId: "player-demo",
    deviceId: "web-page-edge",
    applicationId: "player"
};

const chunks = [];

const segmentDuration = 5;
const video = document.getElementById('videoPlayer');
const mediaSource = new MediaSource();
let sourceBuffer;
let queue = [];
let segmentCounter = 0;
let finishedSegmentCounter = 0;
let savedTime = 0;

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
    video.src = URL.createObjectURL(mediaSource);
});

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

video.addEventListener('timeupdate', () => {
    savedTime = video.currentTime;
    if (segmentCounter > finishedSegmentCounter) {
        const d = segmentDuration * (finishedSegmentCounter + 1);
        const delta = 0.2
        if ((savedTime > (d - delta)) && (savedTime < d)) {
            console.log(`${finishedSegmentCounter + 1} segment playing was done`);
            finishedSegmentCounter += 1;
            sourceBuffer.timestampOffset = delta;
            video.currentTime = d;
            savedTime = video.currentTime;
        }
    }
});

if (!PushcaClient.isOpen()) {
    PushcaClient.openWsConnection(
        wsUrl,
        new ClientFilter(
            pClient.workSpaceId,
            pClient.accountId,
            pClient.deviceId,
            pClient.applicationId
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
            const data = shiftFirstNBytes(binary, 26);
            //chunks.push(data);
            fetchAndQueueChunk(data);
            console.log(`New chunk just arrived: ${binary.byteLength}`);
        }
    );
}

function saveChunk(data) {
    const chunkIndex = chunks.length;
    const combinedBlob = new Blob([new Uint8Array(data)], {type: mimeType});
    const url = URL.createObjectURL(combinedBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recorded_video_${chunkIndex}.mp4`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);

}

/*
document.getElementById("playBtn").addEventListener('click', function (event) {
    initMediaSource();
    delay(1000).then(() => {
        for (let i = 0; i < chunks.length; i++) {
            fetchAndQueueChunk(chunks[i]);
        }
        delay(3000).then(() => {
            video.play();
        });
    });
});*/
