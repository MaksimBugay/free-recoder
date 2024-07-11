function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function convertBlobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const arrayBuffer = event.target.result;
            resolve(arrayBuffer);
        };
        reader.onerror = function (error) {
            reject(error);
        };
        reader.readAsArrayBuffer(blob);
    });
}

function formatString(template, ...values) {
    return template.replace(/{(\d+)}/g, function (match, number) {
        return typeof values[number] != 'undefined' ? values[number] : match;
    });
}

function calculateStringHashCode(s) {
    const utf8Encoder = new TextEncoder();
    const bytes = utf8Encoder.encode(s);
    let h = 0;
    for (const v of bytes) {
        h = 31 * h + (v & 0xff);
        h |= 0; // Convert to 32-bit integer
    }
    return h;
}

function intToBytes(int) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setInt32(0, int, false); // false for big-endian, true for little-endian
    const int8Array = new Int8Array(buffer);
    return Array.from(int8Array);
}

function shortIntToBytes(int) {
    if (int < 0 || int > 255) {
        throw new RangeError("Integer must be in the range 0 to 255.");
    }
    const uint8Array = new Uint8Array(1);
    uint8Array[0] = int;
    const int8Array = new Int8Array(uint8Array.buffer);
    return Array.from(int8Array);
}

function booleanToBytes(bool) {
    const shortInt = bool ? 1 : 0;
    return shortIntToBytes(shortInt);
}

function uuidToBytes(uuidStr) {
    // Parse the UUID string into a byte array
    const uuidBytes = uuid.parse(uuidStr);

    // Create a DataView to handle the bytes
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);

    // Copy the UUID bytes into the DataView
    for (let i = 0; i < 16; i++) {
        view.setUint8(i, uuidBytes[i]);
    }

    // Extract the most significant and least significant bits
    let msb = 0n;
    let lsb = 0n;
    for (let i = 0; i < 8; i++) {
        msb = (msb << 8n) | BigInt(view.getUint8(i));
    }
    for (let i = 8; i < 16; i++) {
        lsb = (lsb << 8n) | BigInt(view.getUint8(i));
    }

    // Write the msb and lsb back to the buffer in big-endian order
    view.setBigUint64(0, msb, false); // false for big-endian
    view.setBigUint64(8, lsb, false); // false for big-endian

    // Convert to signed bytes array
    const signedBytes = new Int8Array(buffer);
    return Array.from(signedBytes);
}

function concatenateByteArrays(...arrays) {
    // Calculate the total length of the concatenated array
    let totalLength = arrays.reduce((acc, array) => acc + array.length, 0);

    // Create a new ArrayBuffer with the total length
    let concatenatedArray = new Uint8Array(totalLength);

    // Copy each byte array into the new Uint8Array
    let offset = 0;
    arrays.forEach(array => {
        concatenatedArray.set(array, offset);
        offset += array.length;
    });

    return concatenatedArray;
}