const playerMimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

const segmentDuration = 5;
let segmentCounter = 0;
let finishedSegmentCounter = 0;
const video = document.getElementById('videoPlayer');
const mediaSource = new MediaSource();
let sourceBuffer;
let queue = [];
let savedTime = 0;

video.src = URL.createObjectURL(mediaSource);
document.getElementById('playButton').addEventListener('click', () => {
    video.src = URL.createObjectURL(mediaSource);
});

function appendNextChunk() {
    if (!sourceBuffer) {
        return;
    }
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

function initMediaSource() {
    video.src = URL.createObjectURL(mediaSource);
    if ('MediaSource' in window && MediaSource.isTypeSupported(playerMimeType)) {
        mediaSource.addEventListener('sourceopen', function () {
                sourceBuffer = mediaSource.addSourceBuffer(playerMimeType);
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
                const delta = 0.11
                //const delta = 0.5
                if (savedTime > (d - delta) && savedTime < (d + delta)) {
                    console.log(`${finishedSegmentCounter + 1} segment playing was done`);
                    finishedSegmentCounter += 1;
                    sourceBuffer.timestampOffset += 5;
                    video.pause();
                    video.currentTime = savedTime + delta;
                    video.play();
                    /*if (segmentCounter > finishedSegmentCounter) {
                        video.play();
                    }*/
                }
            }
        });
        video.play();
    } else {
        console.error('MSE or fMP4 format is not supported in your browser.');
    }
}