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
            chunks.push(shiftFirstNBytes(binary, 26));
            console.log(`${chunks.length} chunk just arrived: ${binary.byteLength}`);
        }
    );
}

function playStream() {
    initMediaSource();
    for (let i = 0; i < chunks.length; i++) {
        delay(1000 * (i + 1)).then(() => {
            fetchAndQueueChunk(chunks[i]);
        });
    }
}

document.getElementById("playBtn").addEventListener('click', function (event) {
    playStream();
});