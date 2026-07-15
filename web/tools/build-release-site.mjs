import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FIRMWARE_NAME = "doom_huskylens.bin";
export const METADATA_NAME = `${FIRMWARE_NAME}.json`;
export const CHECKSUM_NAME = `${FIRMWARE_NAME}.sha256`;
export const SETTINGS_FLASH_OFFSET = 0x7fe000;
export const MAX_FIRMWARE_SIZE = SETTINGS_FLASH_OFFSET - 37;
export const CATALOG_SCHEMA_VERSION = 1;

const API_VERSION = "2022-11-28";
const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseGitHubDigest(value) {
  if (value == null || value === "") return null;
  const match = /^sha256:([a-f0-9]{64})$/i.exec(String(value));
  if (!match) throw new Error(`Unsupported GitHub asset digest: ${value}`);
  return match[1].toLowerCase();
}

export function parseChecksumFile(text, expectedName = FIRMWARE_NAME) {
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([a-f0-9]{64})(?:\s+[*]?(.+))?$/i.exec(line);
    if (!match) continue;
    if (!match[2] || match[2].trim() === expectedName) return match[1].toLowerCase();
  }
  throw new Error(`${CHECKSUM_NAME} does not contain a checksum for ${expectedName}`);
}

function findSingleAsset(release, name) {
  const matches = (release.assets ?? []).filter((asset) => asset.name === name);
  if (matches.length > 1) throw new Error(`${release.tag_name} contains duplicate ${name} assets`);
  return matches[0] ?? null;
}

export function selectReleaseBundles(releases, limit = 10) {
  if (!Array.isArray(releases)) throw new TypeError("GitHub releases response must be an array");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new RangeError("Release limit must be between 1 and 50");

  const bundles = [];
  for (const release of releases) {
    if (release.draft) continue;
    const firmware = findSingleAsset(release, FIRMWARE_NAME);
    const metadata = findSingleAsset(release, METADATA_NAME);
    if (!firmware || !metadata) continue;
    bundles.push({
      release,
      firmware,
      metadata,
      checksum: findSingleAsset(release, CHECKSUM_NAME),
    });
    if (bundles.length === limit) break;
  }
  return bundles;
}

function githubHeaders(token, accept = "application/vnd.github+json") {
  const headers = {
    Accept: accept,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "doom-on-huskylens-pages-builder",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function checkedResponse(response, label) {
  if (!response.ok) throw new Error(`${label}: GitHub returned HTTP ${response.status}`);
  return response;
}

export async function downloadAndVerifyAsset(asset, { token = "", fetchImpl = globalThis.fetch } = {}) {
  if (!asset?.url || !Number.isSafeInteger(asset.size) || asset.size < 0) {
    throw new Error(`Invalid GitHub asset metadata for ${asset?.name ?? "unknown asset"}`);
  }
  const response = await checkedResponse(
    await fetchImpl(asset.url, {
      headers: githubHeaders(token, "application/octet-stream"),
      redirect: "follow",
    }),
    asset.name,
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== asset.size) {
    throw new Error(`${asset.name}: downloaded ${bytes.length} bytes, expected ${asset.size}`);
  }
  const digest = sha256(bytes);
  const githubDigest = parseGitHubDigest(asset.digest);
  if (githubDigest && digest !== githubDigest) {
    throw new Error(`${asset.name}: SHA-256 does not match GitHub asset digest`);
  }
  return { bytes, digest };
}

export function validateReleaseMetadata(raw, firmwareAsset, tag) {
  let metadata;
  try {
    metadata = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${tag}: ${METADATA_NAME} is not valid JSON (${error.message})`);
  }

  if (metadata.project !== "DOOM on HuskyLens") throw new Error(`${tag}: unexpected project name in ${METADATA_NAME}`);
  if (metadata.image !== FIRMWARE_NAME) throw new Error(`${tag}: metadata image must be ${FIRMWARE_NAME}`);
  if (!Number.isSafeInteger(metadata.size) || metadata.size <= 0 || metadata.size > MAX_FIRMWARE_SIZE) {
    throw new Error(`${tag}: metadata firmware size is invalid`);
  }
  if (metadata.size !== firmwareAsset.size) throw new Error(`${tag}: metadata size does not match release asset size`);
  if (!/^[a-f0-9]{64}$/.test(metadata.sha256 ?? "")) throw new Error(`${tag}: metadata SHA-256 is invalid`);
  if (typeof metadata.version !== "string" || !metadata.version.trim()) throw new Error(`${tag}: metadata version is missing`);
  if (metadata.flash_address !== "0x000000") {
    throw new Error(`${tag}: metadata flash address must be 0x000000`);
  }
  if (metadata.settings_address !== "0x7FE000") {
    throw new Error(`${tag}: metadata settings address must be 0x7FE000`);
  }

  return {
    version: metadata.version.trim(),
    size: metadata.size,
    sha256: metadata.sha256,
    flashAddress: metadata.flash_address ?? null,
    settingsAddress: metadata.settings_address ?? null,
  };
}

function assertRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must use owner/name form");
  }
}

async function fetchReleases(repository, token, fetchImpl) {
  assertRepository(repository);
  const url = `https://api.github.com/repos/${repository}/releases?per_page=100`;
  const response = await checkedResponse(
    await fetchImpl(url, { headers: githubHeaders(token) }),
    "release catalog",
  );
  return response.json();
}

async function copyPublicSite(sourceDir, outputDir) {
  const source = path.resolve(sourceDir);
  const output = path.resolve(outputDir);
  if (source === output || output === path.parse(output).root) throw new Error("Unsafe Pages output directory");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const excluded = new Set(["package.json", "README.md", "test", "tools"]);
  await cp(source, output, {
    recursive: true,
    filter(entry) {
      const relative = path.relative(source, entry);
      if (!relative) return true;
      return !excluded.has(relative.split(path.sep)[0]);
    },
  });
}

function safeReleaseUrl(url, repository) {
  const prefix = `https://github.com/${repository}/releases/`;
  if (typeof url !== "string" || !url.startsWith(prefix)) throw new Error(`Unexpected release URL: ${url}`);
  return url;
}

export async function buildReleaseSite({
  repository,
  token = "",
  sourceDir = SOURCE_ROOT,
  outputDir = path.resolve(SOURCE_ROOT, "..", "_site"),
  limit = 10,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  assertRepository(repository);
  await copyPublicSite(sourceDir, outputDir);

  const releases = await fetchReleases(repository, token, fetchImpl);
  const bundles = selectReleaseBundles(releases, limit);
  const catalog = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    repository,
    generatedAt: now().toISOString(),
    releases: [],
  };

  const firmwareDir = path.join(outputDir, "firmware");
  await mkdir(firmwareDir, { recursive: true });

  for (const bundle of bundles) {
    const tag = String(bundle.release.tag_name ?? "");
    if (!tag) throw new Error("A release with firmware assets has no tag");

    const metadataDownload = await downloadAndVerifyAsset(bundle.metadata, { token, fetchImpl });
    const metadata = validateReleaseMetadata(metadataDownload.bytes.toString("utf8"), bundle.firmware, tag);
    const githubFirmwareDigest = parseGitHubDigest(bundle.firmware.digest);
    if (githubFirmwareDigest && githubFirmwareDigest !== metadata.sha256) {
      throw new Error(`${tag}: metadata SHA-256 does not match GitHub firmware digest`);
    }

    if (bundle.checksum) {
      const checksumDownload = await downloadAndVerifyAsset(bundle.checksum, { token, fetchImpl });
      const checksum = parseChecksumFile(checksumDownload.bytes.toString("utf8"));
      if (checksum !== metadata.sha256) throw new Error(`${tag}: checksum sidecar does not match metadata`);
    }

    const firmwareDownload = await downloadAndVerifyAsset(bundle.firmware, { token, fetchImpl });
    if (firmwareDownload.digest !== metadata.sha256) throw new Error(`${tag}: firmware does not match metadata SHA-256`);

    const localName = `${metadata.sha256}.bin`;
    await writeFile(path.join(firmwareDir, localName), firmwareDownload.bytes);
    catalog.releases.push({
      tag,
      name: String(bundle.release.name || tag),
      version: metadata.version,
      publishedAt: bundle.release.published_at ?? null,
      releaseUrl: safeReleaseUrl(bundle.release.html_url, repository),
      prerelease: Boolean(bundle.release.prerelease),
      asset: {
        name: FIRMWARE_NAME,
        url: `./firmware/${localName}`,
        size: metadata.size,
        sha256: metadata.sha256,
      },
    });
  }

  await writeFile(
    path.join(outputDir, "releases.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8",
  );
  return catalog;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const repository = argument("--repository", process.env.GITHUB_REPOSITORY ?? "aztechell/doom_on_huskylens");
  const outputDir = path.resolve(argument("--output", path.resolve(SOURCE_ROOT, "..", "_site")));
  const limit = Number(argument("--limit", process.env.WEB_RELEASE_LIMIT ?? "10"));
  const catalog = await buildReleaseSite({
    repository,
    token: process.env.GITHUB_TOKEN ?? "",
    outputDir,
    limit,
  });
  process.stdout.write(`Built Pages site with ${catalog.releases.length} verified release(s) at ${outputDir}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
