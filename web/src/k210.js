export const FLASH_CAPACITY = 16 * 1024 * 1024;
export const IMAGE_OVERHEAD = 37;
export const SETTINGS_FLASH_OFFSET = 0x7fe000;
export const MAX_FIRMWARE_SIZE = SETTINGS_FLASH_OFFSET - IMAGE_OVERHEAD;
export const BOOT_BAUD_RATE = 115200;
export const FLASH_WRITE_CHUNK_SIZE = 4096;

let protocolLanguage = "en";

export function setProtocolLanguage(language) {
  protocolLanguage = language === "ru" ? "ru" : "en";
}

const protocolMessages = {
  en: {
    shortResponse: "Short device response",
    emptyFirmware: "The firmware image is empty or has an invalid size.",
    largeFirmware: "The image exceeds the {max}-byte limit.",
    validFirmware: "Size fits before the reserved settings area.",
    unknownMode: "Unknown SPI I/O mode",
    cancelled: "Operation cancelled",
    portClosed: "Serial port is not open",
    disconnected: "Serial port disconnected",
    streamClosed: "Serial stream closed",
    responseTimeout: "Device response timed out",
    slipEscape: "Invalid SLIP escape: 0x{byte}",
    slipTimeout: "SLIP frame timed out",
    imagePrepared: "K210 image prepared: {size} bytes",
    loadStub: "Loading open ISP stub into SRAM",
    speed: "Flash speed: 115200 baud",
    flashReady: "Flash memory initialized",
    completed: "Flash operation complete",
    streamRecovered: "Serial input recovered after: {error}",
    enterAttempt: "Entering ISP: attempt {attempt}/15 ({mode})",
    bootromReady: "K210 BootROM responded",
    enterFailed: "Could not enter K210 ISP: {error}",
    noResponse: "no response",
    stubReady: "ISP stub started",
    stubFailed: "ISP stub is not responding",
    retryCommand: "Retry command 0x{operation} ({attempt}/3): {error}",
    commandCode: "Command 0x{operation}: code 0x{reason}",
    wrongCommand: "Expected command 0x{expected}, received 0x{received}",
    writeStart: "Writing image to flash from address 0x000000",
    retryBlock: "Retry block 0x{offset} ({attempt}/10): {error}",
    retryCrc: "Retry block 0x{offset}: CRC error",
    writeCode: "Write error: code 0x{reason}",
    writeFailed: "Could not write block 0x{offset}{detail}",
    reboot: "Restarting K210",
    rebootCode: "Restart error: 0x{reason}",
    rebootFallback: "ISP reboot did not complete ({error}); sending the normal-boot reset sequence",
    rebootReset: "Normal-boot reset sequence sent",
    rebootClosed: "Port closed before the reboot response — this is expected",
  },
  ru: {
    shortResponse: "Короткий ответ устройства",
    emptyFirmware: "Образ прошивки пуст или имеет некорректный размер.",
    largeFirmware: "Образ превышает допустимый предел {max} байт.",
    validFirmware: "Образ помещается до защищённой области настроек.",
    unknownMode: "Неизвестный SPI I/O mode",
    cancelled: "Операция отменена",
    portClosed: "Serial-порт не открыт",
    disconnected: "Serial-порт отключён",
    streamClosed: "Serial-поток закрыт",
    responseTimeout: "Тайм-аут ответа устройства",
    slipEscape: "Некорректный SLIP escape: 0x{byte}",
    slipTimeout: "Тайм-аут SLIP-кадра",
    imagePrepared: "Подготовлен образ K210: {size} байт",
    loadStub: "Загрузка открытого ISP stub в SRAM",
    speed: "Скорость записи: 115200 бод",
    flashReady: "Flash-память инициализирована",
    completed: "Запись завершена",
    streamRecovered: "Входной serial-поток восстановлен после: {error}",
    enterAttempt: "Вход в ISP: попытка {attempt}/15 ({mode})",
    bootromReady: "K210 BootROM отвечает",
    enterFailed: "Не удалось войти в K210 ISP: {error}",
    noResponse: "нет ответа",
    stubReady: "ISP stub запущен",
    stubFailed: "ISP stub не отвечает",
    retryCommand: "Повтор команды 0x{operation} ({attempt}/3): {error}",
    commandCode: "Команда 0x{operation}: код 0x{reason}",
    wrongCommand: "Ожидалась команда 0x{expected}, получена 0x{received}",
    writeStart: "Запись образа во flash с адреса 0x000000",
    retryBlock: "Повтор блока 0x{offset} ({attempt}/10): {error}",
    retryCrc: "Повтор блока 0x{offset}: ошибка CRC",
    writeCode: "Ошибка записи: код 0x{reason}",
    writeFailed: "Не удалось записать блок 0x{offset}{detail}",
    reboot: "Перезапуск K210",
    rebootCode: "Ошибка перезапуска: 0x{reason}",
    rebootFallback: "Команда reboot не завершилась ({error}); выполняется reset в обычный режим",
    rebootReset: "Отправлена последовательность reset в обычный режим",
    rebootClosed: "Порт закрылся до ответа на reboot — это ожидаемо",
  },
};

function protocolText(key, params = {}) {
  const template = protocolMessages[protocolLanguage][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export const Operation = Object.freeze({
  BOOT_NOP: 0xc2,
  MEMORY_WRITE: 0xc3,
  MEMORY_BOOT: 0xc5,
  DEBUG: 0xd1,
  FLASH_NOP: 0xd2,
  FLASH_WRITE: 0xd4,
  FLASH_REBOOT: 0xd5,
  FLASH_INIT: 0xd7,
});

export const ResponseCode = Object.freeze({
  OK: 0xe0,
  BAD_LENGTH: 0xe1,
  BAD_CHECKSUM: 0xe2,
  INVALID_COMMAND: 0xe3,
  BAD_INIT: 0xe4,
  BAD_ERASE: 0xe5,
  BAD_WRITE: 0xe6,
  BUSY: 0xe7,
});

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[n] = value >>> 0;
  }
  return table;
})();

export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
}

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

export function concatBytes(...parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function littleEndian32(...values) {
  const result = new Uint8Array(values.length * 4);
  const view = new DataView(result.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return result;
}

export function makeRequest(operation, payload = new Uint8Array()) {
  const header = new Uint8Array(8);
  const view = new DataView(header.buffer);
  view.setUint16(0, operation, true);
  view.setUint16(2, 0, true);
  view.setUint32(4, crc32(payload), true);
  return concatBytes(header, payload);
}

export function slipEncode(packet) {
  const output = [0xc0];
  for (const byte of packet) {
    if (byte === 0xc0) output.push(0xdb, 0xdc);
    else if (byte === 0xdb) output.push(0xdb, 0xdd);
    else output.push(byte);
  }
  output.push(0xc0);
  return Uint8Array.from(output);
}

export function parseResponse(frame) {
  if (frame.length < 2) throw new ProtocolError(protocolText("shortResponse"));
  return {
    operation: frame[0],
    reason: frame[1],
    text: frame.length > 2 ? new TextDecoder().decode(frame.slice(2)).trim() : "",
  };
}

export function validateFirmwareSize(size) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    return { valid: false, message: protocolText("emptyFirmware") };
  }
  if (size > MAX_FIRMWARE_SIZE) {
    return {
      valid: false,
      message: protocolText("largeFirmware", { max: MAX_FIRMWARE_SIZE }),
    };
  }
  return { valid: true, message: protocolText("validFirmware") };
}

export async function sha256(bytes) {
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

export function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function prepareFirmwareImage(firmware, ioMode = "dio") {
  const sizeCheck = validateFirmwareSize(firmware.length);
  if (!sizeCheck.valid) throw new RangeError(sizeCheck.message);
  if (ioMode !== "dio" && ioMode !== "qio") throw new TypeError(protocolText("unknownMode"));

  const prefix = concatBytes(
    Uint8Array.of(ioMode === "dio" ? 0x02 : 0x00),
    littleEndian32(firmware.length),
    firmware,
  );
  return concatBytes(prefix, await sha256(prefix));
}

export async function withSerialPort(port, openOptions, action) {
  await port.open(openOptions);
  let result;
  let actionError;
  try {
    result = await action();
  } catch (error) {
    actionError = error;
  }

  try {
    await port.close();
  } catch (closeError) {
    if (!actionError) actionError = closeError;
  }

  if (actionError) throw actionError;
  return result;
}

export function serialOpenOptions(baudRate) {
  return {
    baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
    bufferSize: 65536,
  };
}

function abortError() {
  return new DOMException(protocolText("cancelled"), "AbortError");
}

function assertNotAborted(signal) {
  if (signal?.aborted) throw abortError();
}

export class SerialTransport {
  constructor(port, { onRecoverableError = () => {} } = {}) {
    if (!port.readable || !port.writable) throw new ProtocolError(protocolText("portClosed"));
    this.port = port;
    this.reader = null;
    this.writer = port.writable.getWriter();
    this.onRecoverableError = onRecoverableError;
    this.queue = [];
    this.waiters = [];
    this.readError = null;
    this.released = false;
    this.pumpPromise = this.#pump();
  }

  async #pump() {
    while (!this.released) {
      const readable = this.port.readable;
      if (!readable) {
        this.readError = new ProtocolError(protocolText("disconnected"));
        break;
      }

      const reader = readable.getReader();
      this.reader = reader;
      let recoverable = false;
      try {
        while (!this.released) {
          const { value, done } = await reader.read();
          if (done) {
            if (!this.released) this.readError = new ProtocolError(protocolText("streamClosed"));
            break;
          }
          for (const byte of value) {
            const waiter = this.waiters.shift();
            if (waiter) waiter.resolve(byte);
            else this.queue.push(byte);
          }
        }
      } catch (error) {
        if (!this.released && isRecoverableReadError(error)) {
          recoverable = true;
          this.queue.length = 0;
          this.onRecoverableError(error);
          this.#rejectWaiters(error);
        } else if (!this.released) {
          this.readError = error;
        }
      } finally {
        reader.releaseLock();
        if (this.reader === reader) this.reader = null;
      }

      if (this.readError || this.released) break;
      if (recoverable) continue;
    }

    if (this.readError || this.released) {
      this.#rejectWaiters(this.readError ?? new ProtocolError(protocolText("streamClosed")));
    }
  }

  #rejectWaiters(error) {
    this.waiters.splice(0).forEach((waiter) => waiter.reject(error));
  }

  clearInput() {
    this.queue.length = 0;
  }

  async writeRaw(bytes) {
    await this.writer.write(bytes);
  }

  async writePacket(packet) {
    await this.writeRaw(slipEncode(packet));
  }

  async #nextByte(timeoutMs, signal) {
    assertNotAborted(signal);
    if (this.queue.length) return this.queue.shift();
    if (this.readError) throw this.readError;

    return new Promise((resolve, reject) => {
      let waiter;
      const cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
      };
      const onAbort = () => waiter.reject(abortError());
      const timeout = setTimeout(
        () => waiter.reject(new ProtocolError(protocolText("responseTimeout"))),
        timeoutMs,
      );
      waiter = {
        resolve: (value) => { cleanup(); resolve(value); },
        reject: (error) => { cleanup(); reject(error); },
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  async readFrame(timeoutMs = 3000, signal) {
    const deadline = performance.now() + timeoutMs;
    let started = false;
    let escaped = false;
    const frame = [];

    while (performance.now() < deadline) {
      const remaining = Math.max(1, deadline - performance.now());
      const byte = await this.#nextByte(remaining, signal);
      if (!started) {
        if (byte === 0xc0) started = true;
        continue;
      }
      if (escaped) {
        escaped = false;
        if (byte === 0xdc) frame.push(0xc0);
        else if (byte === 0xdd) frame.push(0xdb);
        else throw new ProtocolError(protocolText("slipEscape", { byte: byte.toString(16) }));
      } else if (byte === 0xdb) {
        escaped = true;
      } else if (byte === 0xc0) {
        if (frame.length) return Uint8Array.from(frame);
      } else {
        frame.push(byte);
      }
    }
    throw new ProtocolError(protocolText("slipTimeout"));
  }

  async release() {
    if (this.released) return;
    this.released = true;
    try {
      await this.reader?.cancel();
    } catch {
      // The port may already have disappeared.
    }
    try {
      await this.pumpPromise;
    } catch {
      // The original protocol error is reported by the active operation.
    }
    this.writer.releaseLock();
  }
}

export function isRecoverableReadError(error) {
  const name = String(error?.name ?? "").toLowerCase();
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return ["bufferoverrunerror", "framingerror", "parityerror", "breakerror"].includes(name)
    || /buffer\s*overrun|framing|parity|break condition/.test(message);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fixedCommand = (operation) => concatBytes(Uint8Array.of(0xc0, operation), new Uint8Array(12), Uint8Array.of(0xc0));

export function makeFlashWritePayload(offset, chunk) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError("Invalid flash offset");
  if (!(chunk instanceof Uint8Array) || chunk.length < 1 || chunk.length > FLASH_WRITE_CHUNK_SIZE) {
    throw new RangeError("Invalid flash write chunk");
  }
  const wireChunk = new Uint8Array(FLASH_WRITE_CHUNK_SIZE);
  wireChunk.set(chunk);
  return concatBytes(littleEndian32(offset, wireChunk.length), wireChunk);
}

export async function transmitFlashWrite({
  transport,
  packet,
  offset,
  readResponse,
  signal,
  delay = sleep,
  onLog = () => {},
  maxAttempts = 10,
}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    assertNotAborted(signal);
    if (attempt > 1) {
      await delay(100);
      transport.clearInput();
    }

    try {
      await transport.writePacket(packet);
      while (true) {
        const response = await readResponse();
        if (response.reason === ResponseCode.OK) return;
        if (response.reason === ResponseCode.BUSY) {
          await delay(500);
          continue;
        }
        if (response.reason === ResponseCode.BAD_CHECKSUM) {
          lastError = new ProtocolError(protocolText("retryCrc", { offset: offset.toString(16) }));
          onLog(lastError.message, "warning");
          break;
        }
        throw new ProtocolError(protocolText("writeCode", { reason: response.reason.toString(16) }));
      }
    } catch (error) {
      if (error.name === "AbortError") throw error;
      lastError = error;
      if (attempt < maxAttempts) {
        onLog(
          protocolText("retryBlock", { offset: offset.toString(16), attempt, error: error.message }),
          "warning",
        );
      }
    }
  }
  const detail = lastError ? `: ${lastError.message}` : "";
  throw new ProtocolError(protocolText("writeFailed", { offset: offset.toString(16), detail }));
}

function isExpectedRebootDisconnect(error) {
  const name = String(error?.name ?? "").toLowerCase();
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return ["networkerror", "invalidstateerror", "notfounderror"].includes(name)
    || /port.*closed|serial.*disconnected|stream.*closed|device.*disconnected/.test(message);
}

export async function finishReboot({
  transport,
  readResponse,
  resetToNormalBoot,
  signal,
  onLog = () => {},
}) {
  assertNotAborted(signal);
  await transport.writeRaw(fixedCommand(Operation.FLASH_REBOOT));
  try {
    const response = await readResponse();
    if (response.reason !== ResponseCode.OK && response.reason !== ResponseCode.BUSY) {
      throw new ProtocolError(protocolText("rebootCode", { reason: response.reason.toString(16) }));
    }
    return "command";
  } catch (error) {
    if (error.name === "AbortError") throw error;
    onLog(protocolText("rebootFallback", { error: error.message }), "warning");
  }

  try {
    await resetToNormalBoot();
    onLog(protocolText("rebootReset"), "warning");
    return "reset";
  } catch (error) {
    if (error.name === "AbortError") throw error;
    if (isExpectedRebootDisconnect(error)) {
      onLog(protocolText("rebootClosed"), "warning");
      return "disconnected";
    }
    throw error;
  }
}

export class K210Flasher {
  constructor(port, { onLog = () => {}, onProgress = () => {}, delay = sleep } = {}) {
    this.port = port;
    this.onLog = onLog;
    this.onProgress = onProgress;
    this.delay = delay;
    this.transport = null;
  }

  log(message, level = "info") {
    this.onLog({ message, level });
  }

  progress(stage, current, total, overall) {
    this.onProgress({ stage, current, total, overall });
  }

  async flash(firmware, ispStub, signal) {
    const image = await prepareFirmwareImage(firmware, "dio");
    assertNotAborted(signal);
    this.log(protocolText("imagePrepared", { size: image.length }));

    return withSerialPort(this.port, serialOpenOptions(BOOT_BAUD_RATE), async () => {
      this.#attachTransport();
      try {
        this.progress("bootrom", 0, 1, 0.02);
        await this.#enterBootrom(signal);
        this.progress("bootrom", 1, 1, 0.06);

        this.log(protocolText("loadStub"));
        await this.#uploadStub(ispStub, signal);
        await this.transport.writePacket(makeRequest(Operation.MEMORY_BOOT, littleEndian32(0x80000000, 0)));
        await this.delay(300);

        await this.#connectStub(signal);
        this.log(protocolText("speed"));
        await this.#command(Operation.FLASH_INIT, littleEndian32(1, 0), 5000, signal);
        this.log(protocolText("flashReady"));

        await this.#writeFlash(image, signal);
        this.progress("write", image.length, image.length, 0.98);
        await this.#reboot(signal);
        this.log(protocolText("completed"), "success");
        return { bytesWritten: image.length };
      } finally {
        if (this.transport) {
          await this.transport.release();
          this.transport = null;
        }
      }
    });
  }

  #attachTransport() {
    this.transport = new SerialTransport(this.port, {
      onRecoverableError: (error) => this.log(
        protocolText("streamRecovered", { error: error.message }),
        "warning",
      ),
    });
  }

  async #setSignals(dtr, rts) {
    await this.port.setSignals({ dataTerminalReady: dtr, requestToSend: rts });
    await this.delay(100);
  }

  async #reset(sequence) {
    for (const [dtr, rts] of sequence) await this.#setSignals(dtr, rts);
  }

  async #enterBootrom(signal) {
    const dan = [[false, false], [false, true], [true, false]];
    const kd233 = [[false, false], [true, false], [false, true]];
    let lastError;

    for (let attempt = 1; attempt <= 15; attempt += 1) {
      assertNotAborted(signal);
      const mode = attempt % 2 ? "dan" : "kd233";
      this.log(protocolText("enterAttempt", { attempt, mode }));
      this.transport.clearInput();
      await this.#reset(mode === "dan" ? dan : kd233);
      await this.transport.writeRaw(fixedCommand(Operation.BOOT_NOP));
      try {
        const response = await this.#readResponse(Operation.BOOT_NOP, 1200, signal);
        if (response.reason === ResponseCode.OK || response.reason === 0) {
          this.log(protocolText("bootromReady"));
          return;
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw new ProtocolError(protocolText("enterFailed", { error: lastError?.message ?? protocolText("noResponse") }));
  }

  async #uploadStub(stub, signal) {
    const chunkSize = 1024;
    for (let offset = 0; offset < stub.length; offset += chunkSize) {
      assertNotAborted(signal);
      const chunk = stub.slice(offset, offset + chunkSize);
      await this.#command(
        Operation.MEMORY_WRITE,
        concatBytes(littleEndian32(0x80000000 + offset, chunk.length), chunk),
        5000,
        signal,
      );
      const current = Math.min(stub.length, offset + chunk.length);
      this.progress("stub", current, stub.length, 0.06 + (current / stub.length) * 0.12);
    }
  }

  async #connectStub(signal) {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      assertNotAborted(signal);
      await this.transport.writeRaw(fixedCommand(Operation.FLASH_NOP));
      try {
        const response = await this.#readResponse(Operation.FLASH_NOP, 1500, signal);
        if (response.reason === ResponseCode.OK) {
          this.log(protocolText("stubReady"));
          return;
        }
      } catch {
        await this.delay(100);
      }
    }
    throw new ProtocolError(protocolText("stubFailed"));
  }

  async #command(operation, payload, timeoutMs, signal) {
    const packet = makeRequest(operation, payload);
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      assertNotAborted(signal);
      try {
        await this.transport.writePacket(packet);
        response = await this.#readResponse(operation, timeoutMs, signal);
        break;
      } catch (error) {
        if (error.name === "AbortError") throw error;
        lastError = error;
        if (attempt < 3) {
          this.log(
            protocolText("retryCommand", { operation: operation.toString(16), attempt, error: error.message }),
            "warning",
          );
          this.transport.clearInput();
          await this.delay(100);
        }
      }
    }
    if (!response) throw lastError;
    if (response.reason !== ResponseCode.OK && response.reason !== 0) {
      throw new ProtocolError(protocolText("commandCode", { operation: operation.toString(16), reason: response.reason.toString(16) }));
    }
    return response;
  }

  async #readResponse(expectedOperation, timeoutMs, signal) {
    while (true) {
      const response = parseResponse(await this.transport.readFrame(timeoutMs, signal));
      if (response.operation === Operation.DEBUG) {
        if (response.text) this.log(`ISP: ${response.text}`);
        continue;
      }
      if (response.operation !== expectedOperation) {
        throw new ProtocolError(
          protocolText("wrongCommand", { expected: expectedOperation.toString(16), received: response.operation.toString(16) }),
        );
      }
      return response;
    }
  }

  async #writeFlash(image, signal) {
    this.log(protocolText("writeStart"));
    for (let offset = 0; offset < image.length; offset += FLASH_WRITE_CHUNK_SIZE) {
      assertNotAborted(signal);
      const chunk = image.slice(offset, offset + FLASH_WRITE_CHUNK_SIZE);
      const packet = makeRequest(
        Operation.FLASH_WRITE,
        makeFlashWritePayload(offset, chunk),
      );

      await transmitFlashWrite({
        transport: this.transport,
        packet,
        offset,
        readResponse: () => this.#readResponse(Operation.FLASH_WRITE, 90000, signal),
        signal,
        delay: this.delay,
        onLog: (message, level) => this.log(message, level),
      });

      const current = Math.min(image.length, offset + chunk.length);
      this.progress("write", current, image.length, 0.18 + (current / image.length) * 0.80);
    }
  }

  async #reboot(signal) {
    this.log(protocolText("reboot"));
    await finishReboot({
      transport: this.transport,
      readResponse: () => this.#readResponse(Operation.FLASH_REBOOT, 10000, signal),
      resetToNormalBoot: () => this.#reset([[false, false], [true, false], [false, false]]),
      signal,
      onLog: (message, level) => this.log(message, level),
    });
  }
}
