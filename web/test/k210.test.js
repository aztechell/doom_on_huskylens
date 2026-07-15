import assert from "node:assert/strict";
import test from "node:test";

import {
  IMAGE_OVERHEAD,
  FLASH_WRITE_CHUNK_SIZE,
  MAX_FIRMWARE_SIZE,
  ResponseCode,
  SETTINGS_FLASH_OFFSET,
  bytesToHex,
  crc32,
  finishReboot,
  littleEndian32,
  makeFlashWritePayload,
  makeRequest,
  prepareFirmwareImage,
  SerialTransport,
  setProtocolLanguage,
  slipEncode,
  transmitFlashWrite,
  validateFirmwareSize,
  withSerialPort,
} from "../src/k210.js";

test("protocol messages follow the selected language", () => {
  setProtocolLanguage("en");
  assert.match(validateFirmwareSize(0).message, /image is empty/i);
  setProtocolLanguage("ru");
  assert.match(validateFirmwareSize(0).message, /Образ прошивки пуст/);
  setProtocolLanguage("en");
});

test("CRC-32 matches the standard check vector", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("SLIP escaping handles frame and escape bytes", () => {
  assert.deepEqual(
    [...slipEncode(Uint8Array.of(0x01, 0xc0, 0xdb, 0x02))],
    [0xc0, 0x01, 0xdb, 0xdc, 0xdb, 0xdd, 0x02, 0xc0],
  );
});

test("request header contains little-endian operation and payload CRC", () => {
  const payload = Uint8Array.of(1, 2, 3, 4);
  const request = makeRequest(0xd4, payload);
  const view = new DataView(request.buffer, request.byteOffset, request.byteLength);
  assert.equal(view.getUint16(0, true), 0xd4);
  assert.equal(view.getUint32(4, true), crc32(payload));
  assert.deepEqual([...request.slice(8)], [...payload]);
});

test("firmware limit preserves the settings region at 0x7FE000", () => {
  assert.equal(SETTINGS_FLASH_OFFSET, 0x7fe000);
  assert.equal(MAX_FIRMWARE_SIZE, 8_380_379);
  assert.equal(MAX_FIRMWARE_SIZE + IMAGE_OVERHEAD, SETTINGS_FLASH_OFFSET);
  assert.equal(validateFirmwareSize(MAX_FIRMWARE_SIZE).valid, true);
  assert.equal(validateFirmwareSize(MAX_FIRMWARE_SIZE + 1).valid, false);
});

test("prepared DIO image has flag, length, firmware, and SHA-256 suffix", async () => {
  const firmware = Uint8Array.of(0x10, 0x20, 0x30);
  const image = await prepareFirmwareImage(firmware, "dio");
  assert.equal(image.length, firmware.length + IMAGE_OVERHEAD);
  assert.equal(image[0], 0x02);
  assert.deepEqual([...image.slice(1, 5)], [...littleEndian32(3)]);
  assert.deepEqual([...image.slice(5, 8)], [...firmware]);
  assert.equal(bytesToHex(image.slice(-32)).length, 64);
});

test("flash write payload always pads the final block to 4096 bytes", () => {
  const payload = makeFlashWritePayload(0x2000, Uint8Array.of(0xaa, 0xbb, 0xcc));
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  assert.equal(FLASH_WRITE_CHUNK_SIZE, 4096);
  assert.equal(payload.length, 8 + FLASH_WRITE_CHUNK_SIZE);
  assert.equal(view.getUint32(0, true), 0x2000);
  assert.equal(view.getUint32(4, true), FLASH_WRITE_CHUNK_SIZE);
  assert.deepEqual([...payload.slice(8, 11)], [0xaa, 0xbb, 0xcc]);
  assert.ok(payload.slice(11).every((byte) => byte === 0));
});

test("BUSY responses are polled without retransmitting the flash packet", async () => {
  let writes = 0;
  let clears = 0;
  let reads = 0;
  const responses = [ResponseCode.BUSY, ResponseCode.BUSY, ResponseCode.OK];
  await transmitFlashWrite({
    transport: {
      async writePacket() { writes += 1; },
      clearInput() { clears += 1; },
    },
    packet: Uint8Array.of(1),
    offset: 0,
    async readResponse() { reads += 1; return { reason: responses.shift() }; },
    async delay() {},
  });
  assert.equal(writes, 1);
  assert.equal(clears, 0);
  assert.equal(reads, 3);
});

test("checksum rejection retransmits once after clearing stale input", async () => {
  let writes = 0;
  let clears = 0;
  const responses = [ResponseCode.BAD_CHECKSUM, ResponseCode.OK];
  await transmitFlashWrite({
    transport: {
      async writePacket() { writes += 1; },
      clearInput() { clears += 1; },
    },
    packet: Uint8Array.of(1),
    offset: 0x1000,
    async readResponse() { return { reason: responses.shift() }; },
    async delay() {},
  });
  assert.equal(writes, 2);
  assert.equal(clears, 1);
});

test("an explicit reboot error falls back to the normal-boot reset", async () => {
  let writes = 0;
  let resets = 0;
  const result = await finishReboot({
    transport: { async writeRaw() { writes += 1; } },
    async readResponse() { return { reason: ResponseCode.BAD_INIT }; },
    async resetToNormalBoot() { resets += 1; },
  });
  assert.equal(result, "reset");
  assert.equal(writes, 1);
  assert.equal(resets, 1);
});

test("an unexpected reset failure is not reported as a successful reboot", async () => {
  await assert.rejects(
    finishReboot({
      transport: { async writeRaw() {} },
      async readResponse() { throw new ProtocolError("timeout"); },
      async resetToNormalBoot() { throw new TypeError("setSignals failed"); },
    }),
    /setSignals failed/,
  );
});

test("serial port is closed after success and failure", async () => {
  const successCalls = [];
  const successPort = {
    async open(options) { successCalls.push(["open", options.baudRate]); },
    async close() { successCalls.push(["close"]); },
  };
  await withSerialPort(successPort, { baudRate: 115200 }, async () => successCalls.push(["action"]));
  assert.deepEqual(successCalls, [["open", 115200], ["action"], ["close"]]);

  let closeCount = 0;
  const failurePort = { async open() {}, async close() { closeCount += 1; } };
  await assert.rejects(
    withSerialPort(failurePort, {}, async () => { throw new Error("protocol failed"); }),
    /protocol failed/,
  );
  assert.equal(closeCount, 1);
});

test("serial reader recovers from a buffer overrun", async () => {
  let controller;
  let recoveries = 0;
  const port = {
    readable: new ReadableStream({ start(value) { controller = value; } }),
    writable: new WritableStream(),
  };
  const transport = new SerialTransport(port, { onRecoverableError() { recoveries += 1; } });
  const interrupted = transport.readFrame(1000);
  port.readable = new ReadableStream({
    start(stream) { stream.enqueue(Uint8Array.of(0xc0, 0xd2, 0xe0, 0xc0)); },
  });
  controller.error(new DOMException("Buffer overrun", "BufferOverrunError"));
  await assert.rejects(interrupted, /Buffer overrun/);
  assert.deepEqual([...await transport.readFrame(1000)], [0xd2, 0xe0]);
  assert.equal(recoveries, 1);
  await transport.release();
});
