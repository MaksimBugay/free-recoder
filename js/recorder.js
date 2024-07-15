const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
let recording = false;
const chunks = [];
const chunkInterval = 5000;
const wsUrl = 'wss://vasilii.prodpushca.com:30085/';
let pingIntervalId = null;
const pClient = {
    workSpaceId: "media-stream-test",
    accountId: "demo",
    deviceId: "web-page-edge",
    applicationId: "recorder"
};
const clientHashCode = calculateClientHashCode(
    pClient.workSpaceId,
    pClient.accountId,
    pClient.deviceId,
    pClient.applicationId
);
const binaryId = uuid.v4();
//const binaryId = '972cb48f-7808-47cf-854a-a9b7ae0ce7c3';
const sourceUrl = formatString(
    'http://vasilii.prodpushca.com:8070/{0}/playlist.m3u8',
    binaryId
);
console.log(`Hls source url = ${sourceUrl}`);
const binaryType = BinaryType.MEDIA_STREAM;
const withAcknowledge = false;

console.log(`Binary id = ${binaryId.toString()}`);
console.log(uuidToBytes(binaryId));
console.log("Java: [-105, 44, -76, -113, 120, 8, 71, -49, -123, 74, -87, -73, -82, 12, -25, -61]")

console.log(`Client hash code = ${clientHashCode}`);
console.log(intToBytes(clientHashCode));
if (clientHashCode !== -1752126113) {
    console.error("Incorrect client hash code ");
}
console.log('Binary type');
console.log(shortIntToBytes(binaryType));
console.log('withAcknowledge');
console.log(booleanToBytes(withAcknowledge));

let playStreamInProgress = false;
let savedSegmentCounter = 0;

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
                savedSegmentCounter += 1;
                if (savedSegmentCounter === 1) {
                    delay(3000).then(() => {
                        initMediaSource();
                        fetchAndQueueChunk(shiftFirstNBytes(binary, 26));
                    })
                } else {
                    fetchAndQueueChunk(shiftFirstNBytes(binary, 26));
                }
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
    })
} catch (error) {
    console.error("An error occurred:", error);
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        mediaRecorder = new MediaRecorder(stream, {mimeType: mimeType});

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0 && recording) {
                const blob = event.data;
                //console.log('Blob type:', blob.type);

                chunks.push(blob);
                uploadChunk(blob, chunks.length - 1);
                console.log(`${chunks.length} chunks were recorded`);
            }
        };

        mediaRecorder.onstop = () => {
            if (recording) {
                recordChunk();
            } else {
                stream.getTracks().forEach(track => track.stop());
            }
        };

        recording = true;
        recordChunk();
        return {status: 0, message: 'recording started'};
    } catch (err) {
        return {status: -1, message: `Cannot start, error accessing media devices: ${err}`};
    }
}

function recordChunk() {
    if (!recording) return;

    mediaRecorder.start();
    delay(chunkInterval).then(() => {
        mediaRecorder.stop();
    });
}

function stopRecording() {
    recording = false;
    try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            //mediaRecorder.stop();
        }
        delay(5000).then(() => {
            //saveRecording();
            //playRecording();
            //playStream();
        })
        return {status: 0, message: 'recording stopped'};
    } catch (err) {
        return {status: -1, message: `Cannot stop, error accessing media devices: ${err}`};
    }
}

function playStream() {
    if (playStreamInProgress) {
        return;
    }
    playStreamInProgress = true;
    const video = document.getElementById('videoPlayer');
    if (Hls.isSupported()) {
        console.log("Hls is supported!");
        const hls = new Hls({
            manifestLoadingTimeOut: 4000, // Time before timing out the request (in milliseconds)
            //manifestLoadingMaxRetry: Infinity, // Number of times to retry loading the manifest
            manifestLoadingRetryDelay: 50000, // Delay between retries (in milliseconds)
            manifestLoadingMaxRetryTimeout: 64000 // Maximum retry timeout (in milliseconds)
        });

        // Listen for error events
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Network error:', data);
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Media error:', data);
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error('Error:', data);
                        hls.destroy();
                        break;
                }
            }
        });

        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            console.log('Manifest details:', data);

            // Optionally, print the raw manifest
            fetch(sourceUrl)
                .then(response => response.text())
                .then(manifestText => {
                    console.log('Manifest content:', manifestText);
                })
                .catch(error => {
                    console.error('Error fetching manifest:', error);
                });
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            video.play();
        });
        hls.on(Hls.Events.LEVEL_UPDATED, function (event, data) {
            console.log('Level updated, manifest:', data);
            fetch(hls.url)
                .then(response => response.text())
                .then(text => {
                    console.log('Updated manifest:\n', text);
                });
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = sourceUrl;
        video.addEventListener('canplay', function () {
            video.play();
        });

        // Print the manifest details to the console for native HLS support
        fetch(sourceUrl)
            .then(response => response.text())
            .then(manifestText => {
                console.log('Manifest content:', manifestText);
            })
            .catch(error => {
                console.error('Error fetching manifest:', error);
            });
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

function uploadChunk(chunkBlob, order) {
    if (chunkBlob.size < 1) {
        return;
    }
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
            //console.log(`Segment ${order} was sent`);
        }
    }).catch((error) => {
        console.error("Error converting Blob to Uint8Array:", error);
    });
}

function saveRecording() {
    console.log(`Chunks number = ${chunks.length}`);
    const blob = new Blob(chunks, {type: mimeType});
    convertBlobToArrayBuffer(blob).then((arrayBuffer) => {
        const customHeader = buildPushcaBinaryHeader(
            binaryType, clientHashCode, withAcknowledge, binaryId, 0
        );
        const combinedBuffer = new ArrayBuffer(customHeader.length + arrayBuffer.byteLength);
        const combinedView = new Uint8Array(combinedBuffer);
        combinedView.set(customHeader, 0);
        combinedView.set(new Uint8Array(arrayBuffer), customHeader.length);

        //ws.send(combinedBuffer);

        const combinedBlob = new Blob([combinedView], {type: mimeType});
        const url = URL.createObjectURL(combinedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'recorded_video.mp4';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
    }).catch((error) => {
        console.error("Error converting Blob to Uint8Array:", error);
    });
}

function saveSegmentToFile(arrayBuffer) {
    try {
        const blob = new Blob([arrayBuffer], {type: mimeType});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        savedSegmentCounter += 1;
        a.download = `recorded_video_${savedSegmentCounter}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error saving segment to file:', error);
    }
}