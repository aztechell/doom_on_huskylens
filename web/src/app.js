import {
  K210Flasher,
  MAX_FIRMWARE_SIZE,
  bytesToHex,
  setProtocolLanguage,
  sha256,
  validateFirmwareSize,
} from "./k210.js";

const EXPECTED_STUB_SHA256 = "30dd09e36d3b3e4fd912ae0f65f600960598531cd4e13826f2e3cfd3e4b95bb3";
const CATALOG_SCHEMA_VERSION = 1;

const translations = {
  en: {
    "brand.label": "DOOM on HuskyLens, open flasher",
    "browser.checking": "Checking browser…",
    "browser.ready": "Web Serial ready",
    "browser.unsupported": "Chrome or Edge required",
    "hero.kicker": "Tiny console. Full adventure.",
    "hero.title": "Put DOOM on your HuskyLens",
    "hero.copy": "Pick a release, connect one cable, and flash. No SDK, terminal, or firmware file hunting.",
    "hero.device": "Made for HuskyLens SEN0305",
    "hero.browser": "Desktop Chrome / Edge",
    "hero.wad": "WAD stays on your SD card",
    "steps.kicker": "Three simple steps",
    "device.title": "Connect HuskyLens",
    "device.help": "Plug it into this computer over USB, then choose its serial port.",
    "device.none": "No device selected",
    "device.waiting": "Waiting for permission",
    "device.select": "Select device",
    "device.selectAnother": "Change device",
    "release.title": "Choose a version",
    "release.help": "Firmware comes from verified releases and must fit before the reserved settings area.",
    "release.loadingCatalog": "Loading available releases…",
    "release.none": "No installable release is available yet.",
    "release.choose": "Choose a release",
    "release.loading": "Downloading and checking firmware…",
    "release.ready": "Firmware verified and ready.",
    "release.error": "Firmware could not be prepared: {error}",
    "release.catalogError": "Release catalog is unavailable: {error}",
    "release.stable": "stable",
    "release.prerelease": "preview",
    "release.version": "Version",
    "release.published": "Published",
    "release.size": "Download",
    "release.sha": "SHA-256",
    "release.notes": "Release notes",
    "release.unselected": "Select a version to continue.",
    "action.title": "Flash and play",
    "action.help": "Review the warning, start flashing, and keep the cable connected until completion.",
    "action.consent": "I understand this replaces the current HuskyLens firmware.",
    "action.flash": "Flash DOOM",
    "action.cancel": "Cancel",
    "action.warning": "Do not disconnect USB or power while flashing.",
    "stage.ready": "Ready",
    "stage.bootrom": "Connecting to HuskyLens",
    "stage.stub": "Starting programmer",
    "stage.write": "Writing firmware",
    "stage.done": "DOOM is installed",
    "stages.device": "Device",
    "stages.deviceHelp": "Enter K210 BootROM",
    "stages.programmer": "Programmer",
    "stages.programmerHelp": "Prepare flash memory",
    "stages.firmware": "Firmware",
    "stages.firmwareHelp": "Write verified image",
    "stages.done": "Done",
    "stages.doneHelp": "Restart HuskyLens",
    "next.title": "After flashing",
    "next.copy": "Put a supported WAD in /DOOM/ on a FAT32 SD card, insert it, and restart HuskyLens.",
    "next.link": "Installation and controls",
    "log.title": "Technical log",
    "log.expand": "Show",
    "log.collapse": "Hide",
    "log.clear": "Clear",
    "log.ready": "Flasher ready",
    "log.webSerialUnavailable": "Web Serial is unavailable. Open this page in desktop Chrome or Edge over HTTPS.",
    "log.deviceSelected": "Device selected: {meta}",
    "log.deviceError": "Could not select device: {error}",
    "log.disconnected": "Device disconnected",
    "log.catalogLoaded": "Loaded {count} release(s)",
    "log.releaseChecked": "Verified {tag}: {hash}",
    "log.downloadError": "Firmware preparation failed: {error}",
    "stub.unavailable": "ISP stub unavailable: HTTP {status}",
    "stub.checksum": "ISP stub checksum does not match",
    "stub.checked": "ISP stub verified: {size} bytes",
    "flash.start": "Confirmation received. Starting flash operation.",
    "flash.cancelled": "Operation cancelled by the user",
    "flash.error": "Error: {error}",
    "status.cancelled": "Cancelled · port closed",
    "status.error": "Error · port closed",
    "footer.independent": "Independent community project · not affiliated with DFRobot or id Software",
  },
  ru: {
    "brand.label": "DOOM on HuskyLens, к загрузчику",
    "browser.checking": "Проверка браузера…",
    "browser.ready": "Web Serial готов",
    "browser.unsupported": "Нужен Chrome или Edge",
    "hero.kicker": "Маленькая консоль. Большое приключение.",
    "hero.title": "Установите DOOM на HuskyLens",
    "hero.copy": "Выберите релиз, подключите один кабель и прошейте. Без SDK, терминала и поиска файла прошивки.",
    "hero.device": "Для HuskyLens SEN0305",
    "hero.browser": "Chrome / Edge на компьютере",
    "hero.wad": "WAD остаётся на SD-карте",
    "steps.kicker": "Три простых шага",
    "device.title": "Подключите HuskyLens",
    "device.help": "Соедините устройство с компьютером по USB и выберите его serial-порт.",
    "device.none": "Устройство не выбрано",
    "device.waiting": "Ожидание разрешения",
    "device.select": "Выбрать устройство",
    "device.selectAnother": "Сменить устройство",
    "release.title": "Выберите версию",
    "release.help": "Прошивка загружается из проверенных релизов и не затрагивает защищённую область настроек.",
    "release.loadingCatalog": "Загрузка доступных релизов…",
    "release.none": "Пока нет релиза, готового к установке.",
    "release.choose": "Выберите релиз",
    "release.loading": "Загрузка и проверка прошивки…",
    "release.ready": "Прошивка проверена и готова.",
    "release.error": "Не удалось подготовить прошивку: {error}",
    "release.catalogError": "Каталог релизов недоступен: {error}",
    "release.stable": "стабильный",
    "release.prerelease": "предварительный",
    "release.version": "Версия",
    "release.published": "Опубликован",
    "release.size": "Размер",
    "release.sha": "SHA-256",
    "release.notes": "Описание релиза",
    "release.unselected": "Выберите версию, чтобы продолжить.",
    "action.title": "Прошейте и играйте",
    "action.help": "Прочитайте предупреждение, запустите прошивку и не отключайте кабель до завершения.",
    "action.consent": "Я понимаю, что текущая прошивка HuskyLens будет заменена.",
    "action.flash": "Установить DOOM",
    "action.cancel": "Отмена",
    "action.warning": "Не отключайте USB и питание во время прошивки.",
    "stage.ready": "Готов",
    "stage.bootrom": "Подключение к HuskyLens",
    "stage.stub": "Запуск программатора",
    "stage.write": "Запись прошивки",
    "stage.done": "DOOM установлен",
    "stages.device": "Устройство",
    "stages.deviceHelp": "Вход в K210 BootROM",
    "stages.programmer": "Программатор",
    "stages.programmerHelp": "Подготовка flash-памяти",
    "stages.firmware": "Прошивка",
    "stages.firmwareHelp": "Запись проверенного образа",
    "stages.done": "Готово",
    "stages.doneHelp": "Перезапуск HuskyLens",
    "next.title": "После прошивки",
    "next.copy": "Запишите поддерживаемый WAD в /DOOM/ на FAT32 SD-карте, вставьте её и перезапустите HuskyLens.",
    "next.link": "Установка и управление",
    "log.title": "Технический журнал",
    "log.expand": "Показать",
    "log.collapse": "Скрыть",
    "log.clear": "Очистить",
    "log.ready": "Загрузчик готов",
    "log.webSerialUnavailable": "Web Serial недоступен. Откройте страницу по HTTPS в Chrome или Edge на компьютере.",
    "log.deviceSelected": "Устройство выбрано: {meta}",
    "log.deviceError": "Не удалось выбрать устройство: {error}",
    "log.disconnected": "Устройство отключено",
    "log.catalogLoaded": "Загружено релизов: {count}",
    "log.releaseChecked": "Проверен {tag}: {hash}",
    "log.downloadError": "Подготовка прошивки не удалась: {error}",
    "stub.unavailable": "ISP stub недоступен: HTTP {status}",
    "stub.checksum": "Контрольная сумма ISP stub не совпадает",
    "stub.checked": "ISP stub проверен: {size} байт",
    "flash.start": "Подтверждение получено. Начинаю запись.",
    "flash.cancelled": "Операция отменена пользователем",
    "flash.error": "Ошибка: {error}",
    "status.cancelled": "Отменено · порт закрыт",
    "status.error": "Ошибка · порт закрыт",
    "footer.independent": "Независимый проект сообщества · не связан с DFRobot или id Software",
  },
};

const elements = {
  browserBadge: document.querySelector("#browser-badge"),
  languageButtons: [...document.querySelectorAll("[data-language]")],
  connectButton: document.querySelector("#connect-button"),
  deviceName: document.querySelector("#device-name"),
  deviceMeta: document.querySelector("#device-meta"),
  releaseSelect: document.querySelector("#release-select"),
  releaseState: document.querySelector("#release-state"),
  releaseTag: document.querySelector("#release-tag"),
  releasePublished: document.querySelector("#release-published"),
  releaseSize: document.querySelector("#release-size"),
  releaseHash: document.querySelector("#release-hash"),
  releaseLink: document.querySelector("#release-link"),
  consent: document.querySelector("#consent"),
  flashButton: document.querySelector("#flash-button"),
  cancelButton: document.querySelector("#cancel-button"),
  progressBar: document.querySelector("#progress-bar"),
  progressValue: document.querySelector("#progress-value"),
  progressStage: document.querySelector("#progress-stage"),
  stageItems: [...document.querySelectorAll("[data-stage]")],
  logPanel: document.querySelector("#log-panel"),
  logPreview: document.querySelector("#log-preview"),
  log: document.querySelector("#operation-log"),
  clearLog: document.querySelector("#clear-log"),
};

const state = {
  language: "en",
  supported: false,
  port: null,
  catalog: [],
  catalogLoaded: false,
  releaseError: null,
  release: null,
  firmware: null,
  loadingFirmware: false,
  downloadController: null,
  flashing: false,
  flashController: null,
  currentStage: "ready",
  overall: 0,
  writeCurrent: null,
  writeTotal: null,
  statusOverride: null,
};

function t(key, params = {}) {
  const template = translations[state.language][key] ?? translations.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

function locale() {
  return state.language === "ru" ? "ru-RU" : "en-US";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes.toLocaleString(locale())} B`;
  return `${(bytes / (1024 * 1024)).toLocaleString(locale(), { maximumFractionDigits: 2 })} MiB`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale(), { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function setLanguage(language, { announce = true } = {}) {
  state.language = language === "ru" ? "ru" : "en";
  setProtocolLanguage(state.language);
  document.documentElement.lang = state.language;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
  for (const button of elements.languageButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.language === state.language));
  }
  renderBrowserState();
  renderDeviceState();
  renderReleaseOptions();
  renderReleaseState();
  renderStatus();
  if (announce) log(state.language === "ru" ? "Язык изменён на русский" : "Language changed to English");
}

function log(message, level = "info") {
  const item = document.createElement("li");
  item.className = `log-line is-${level}`;
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString(locale(), { hour12: false });
  const text = document.createElement("span");
  text.textContent = message;
  item.append(time, text);
  elements.log.append(item);
  while (elements.log.children.length > 250) elements.log.firstElementChild.remove();
  elements.logPreview.textContent = message;
  elements.logPreview.className = `log-preview is-${level}`;
  if (level === "error") elements.logPanel.open = true;
}

function renderBrowserState() {
  elements.browserBadge.textContent = t(state.supported ? "browser.ready" : "browser.unsupported");
  elements.browserBadge.className = `browser-badge ${state.supported ? "is-ready" : "is-error"}`;
}

function deviceLabel(port) {
  const info = port?.getInfo?.() ?? {};
  const vendor = info.usbVendorId ? `VID ${info.usbVendorId.toString(16).padStart(4, "0").toUpperCase()}` : null;
  const product = info.usbProductId ? `PID ${info.usbProductId.toString(16).padStart(4, "0").toUpperCase()}` : null;
  return {
    name: "HuskyLens / K210",
    meta: [vendor, product].filter(Boolean).join(" · ") || "Web Serial port",
  };
}

function renderDeviceState() {
  if (state.port) {
    const label = deviceLabel(state.port);
    elements.deviceName.textContent = label.name;
    elements.deviceMeta.textContent = label.meta;
    elements.connectButton.textContent = t("device.selectAnother");
  } else {
    elements.deviceName.textContent = t("device.none");
    elements.deviceMeta.textContent = t("device.waiting");
    elements.connectButton.textContent = t("device.select");
  }
}

function releaseLabel(release) {
  const channel = t(release.prerelease ? "release.prerelease" : "release.stable");
  return `${release.name || release.tag} · ${channel}`;
}

function renderReleaseOptions() {
  const selected = state.release?.tag ?? elements.releaseSelect.value;
  elements.releaseSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.catalog.length ? t("release.choose") : t("release.none");
  elements.releaseSelect.append(placeholder);
  for (const release of state.catalog) {
    const option = document.createElement("option");
    option.value = release.tag;
    option.textContent = releaseLabel(release);
    elements.releaseSelect.append(option);
  }
  elements.releaseSelect.value = state.catalog.some((release) => release.tag === selected) ? selected : "";
}

function renderReleaseState() {
  const release = state.release;
  const ready = Boolean(release && state.firmware);
  elements.releaseState.className = `validation${ready ? " is-valid" : state.loadingFirmware ? " is-loading" : ""}`;
  if (state.releaseError) elements.releaseState.textContent = state.releaseError;
  else if (state.loadingFirmware) elements.releaseState.textContent = t("release.loading");
  else if (ready) elements.releaseState.textContent = t("release.ready");
  else if (!state.catalogLoaded) elements.releaseState.textContent = t("release.loadingCatalog");
  else if (!state.catalog.length) elements.releaseState.textContent = t("release.none");
  else elements.releaseState.textContent = t("release.unselected");
  elements.releaseState.classList.toggle("is-error", Boolean(state.releaseError) || (state.catalogLoaded && !state.catalog.length));

  elements.releaseTag.textContent = release?.tag ?? "—";
  elements.releasePublished.textContent = release ? formatDate(release.publishedAt) : "—";
  elements.releaseSize.textContent = release ? formatBytes(release.asset.size) : "—";
  elements.releaseHash.textContent = release?.asset.sha256 ?? "—";
  elements.releaseLink.hidden = !release;
  if (release) elements.releaseLink.href = release.releaseUrl;
}

function setReleaseError(key, error) {
  state.releaseError = t(key, { error });
  renderReleaseState();
  log(t("log.downloadError", { error }), "error");
}

function renderStatus() {
  const percent = Math.round(state.overall * 100);
  elements.progressBar.value = percent;
  elements.progressValue.textContent = `${percent}%`;
  elements.progressStage.textContent = state.statusOverride ? t(state.statusOverride) : t(`stage.${state.currentStage}`);
  const stageIndex = { ready: 0, bootrom: 0, stub: 1, write: 2, done: 3 }[state.currentStage] ?? 0;
  elements.stageItems.forEach((item, index) => {
    item.classList.toggle("is-active", index === stageIndex);
    item.classList.toggle("is-complete", index < stageIndex);
  });
  const writing = state.currentStage === "write" && state.writeTotal;
  elements.progressBar.setAttribute("aria-label", writing
    ? `${t("stage.write")}: ${formatBytes(state.writeCurrent)} / ${formatBytes(state.writeTotal)}`
    : elements.progressStage.textContent);
}

function setStatus(stage, overall, current = null, total = null) {
  state.currentStage = stage;
  state.overall = Math.max(0, Math.min(1, overall));
  state.writeCurrent = stage === "write" ? current : null;
  state.writeTotal = stage === "write" ? total : null;
  state.statusOverride = null;
  renderStatus();
}

function updateActions() {
  const ready = Boolean(state.port && state.firmware && elements.consent.checked);
  elements.flashButton.disabled = !ready || state.flashing || state.loadingFirmware;
  elements.connectButton.disabled = state.flashing || !state.supported;
  elements.releaseSelect.disabled = state.flashing || !state.catalog.length;
  elements.consent.disabled = state.flashing || state.loadingFirmware || !state.firmware;
  elements.cancelButton.hidden = !state.flashing;
}

async function selectDevice() {
  try {
    state.port = await navigator.serial.requestPort();
    const label = deviceLabel(state.port);
    renderDeviceState();
    log(t("log.deviceSelected", { meta: label.meta }), "success");
  } catch (error) {
    if (error.name !== "NotFoundError") log(t("log.deviceError", { error: error.message }), "error");
  }
  updateActions();
}

function assertCatalog(catalog) {
  if (catalog?.schemaVersion !== CATALOG_SCHEMA_VERSION || !Array.isArray(catalog.releases)) {
    throw new Error("unsupported catalog format");
  }
  for (const release of catalog.releases) {
    const assetUrl = new URL(release?.asset?.url, window.location.href);
    if (!release?.tag || !release?.releaseUrl || !Number.isSafeInteger(release?.asset?.size)
        || !/^[a-f0-9]{64}$/.test(release?.asset?.sha256 ?? "")
        || assetUrl.origin !== window.location.origin
        || !assetUrl.pathname.includes("/firmware/")) {
      throw new Error("invalid release entry");
    }
  }
  return catalog.releases;
}

async function loadCatalog() {
  try {
    const response = await fetch("./releases.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.catalog = assertCatalog(await response.json());
    state.catalogLoaded = true;
    state.releaseError = null;
    renderReleaseOptions();
    log(t("log.catalogLoaded", { count: state.catalog.length }), "success");
    const preferred = state.catalog.find((release) => !release.prerelease) ?? state.catalog[0];
    if (preferred) {
      elements.releaseSelect.value = preferred.tag;
      await selectRelease(preferred.tag);
    } else {
      renderReleaseState();
    }
  } catch (error) {
    state.catalog = [];
    state.catalogLoaded = true;
    state.releaseError = t("release.catalogError", { error: error.message });
    renderReleaseOptions();
    renderReleaseState();
    log(state.releaseError, "error");
  }
  updateActions();
}

async function selectRelease(tag) {
  state.downloadController?.abort();
  elements.consent.checked = false;
  state.releaseError = null;
  state.firmware = null;
  state.release = state.catalog.find((release) => release.tag === tag) ?? null;
  if (!state.release) {
    state.loadingFirmware = false;
    renderReleaseState();
    updateActions();
    return;
  }

  const controller = new AbortController();
  state.downloadController = controller;
  state.loadingFirmware = true;
  renderReleaseState();
  updateActions();

  try {
    const validation = validateFirmwareSize(state.release.asset.size);
    if (!validation.valid) throw new Error(validation.message);
    const response = await fetch(state.release.asset.url, { cache: "force-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const firmware = new Uint8Array(await response.arrayBuffer());
    if (firmware.length !== state.release.asset.size) throw new Error("download size does not match release metadata");
    const digest = bytesToHex(await sha256(firmware));
    if (digest !== state.release.asset.sha256) throw new Error("SHA-256 does not match release metadata");
    if (state.downloadController !== controller) return;
    state.firmware = firmware;
    log(t("log.releaseChecked", { tag: state.release.tag, hash: digest }), "success");
  } catch (error) {
    if (error.name === "AbortError") return;
    if (state.downloadController === controller) setReleaseError("release.error", error.message);
  } finally {
    if (state.downloadController === controller) {
      state.downloadController = null;
      state.loadingFirmware = false;
      renderReleaseState();
      updateActions();
    }
  }
}

async function loadIspStub() {
  const response = await fetch(
    `./isp_stub/isp_prog_huskylens.bin?v=${EXPECTED_STUB_SHA256}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(t("stub.unavailable", { status: response.status }));
  const stub = new Uint8Array(await response.arrayBuffer());
  const digest = bytesToHex(await sha256(stub));
  if (digest !== EXPECTED_STUB_SHA256) throw new Error(t("stub.checksum"));
  return stub;
}

async function startFlash() {
  if (!state.port || !state.firmware || !elements.consent.checked) return;
  state.flashing = true;
  state.flashController = new AbortController();
  updateActions();
  setStatus("bootrom", 0.01);
  log(t("flash.start"), "warning");

  try {
    const stub = await loadIspStub();
    log(t("stub.checked", { size: stub.length }));
    const flasher = new K210Flasher(state.port, {
      onLog: ({ message, level }) => log(message, level),
      onProgress: ({ stage, current, total, overall }) => setStatus(stage, overall, current, total),
    });
    await flasher.flash(state.firmware, stub, state.flashController.signal);
    setStatus("done", 1);
  } catch (error) {
    const cancelled = error.name === "AbortError";
    log(cancelled ? t("flash.cancelled") : t("flash.error", { error: error.message }), cancelled ? "warning" : "error");
    state.statusOverride = cancelled ? "status.cancelled" : "status.error";
    renderStatus();
  } finally {
    state.flashing = false;
    state.flashController = null;
    elements.consent.checked = false;
    updateActions();
  }
}

async function initialize() {
  state.supported = "serial" in navigator && window.isSecureContext;
  setLanguage("en", { announce: false });
  renderStatus();
  updateActions();
  if (!state.supported) log(t("log.webSerialUnavailable"), "error");
  else {
    log(t("log.ready"));
    navigator.serial.addEventListener("disconnect", (event) => {
      if (event.port === state.port) {
        state.port = null;
        renderDeviceState();
        log(t("log.disconnected"), "warning");
        updateActions();
      }
    });
  }
  await loadCatalog();
}

for (const button of elements.languageButtons) {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
}
elements.connectButton.addEventListener("click", selectDevice);
elements.releaseSelect.addEventListener("change", (event) => selectRelease(event.target.value));
elements.consent.addEventListener("change", updateActions);
elements.flashButton.addEventListener("click", startFlash);
elements.cancelButton.addEventListener("click", () => state.flashController?.abort());
elements.clearLog.addEventListener("click", () => {
  elements.log.replaceChildren();
  elements.logPreview.textContent = "—";
  elements.logPreview.className = "log-preview";
});

initialize();
