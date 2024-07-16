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
            /*if (chunks.length === 0) {
                delay(4000).then(() => {
                    initMediaSource();
                    delay(1000).then(() => {
                        fetchAndQueueChunk(data);
                    });
                });
            } else {
                delay(1000).then(() => {
                    fetchAndQueueChunk(data);
                });
            }*/
            chunks.push(data);
            saveChunk(data);
            console.log(`${chunks.length} chunk just arrived: ${binary.byteLength}`);
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

document.getElementById("playBtn").addEventListener('click', function (event) {
});