import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CHECKSUM_NAME,
  FIRMWARE_NAME,
  MAX_FIRMWARE_SIZE,
  METADATA_NAME,
  buildReleaseSite,
  parseChecksumFile,
  parseGitHubDigest,
  selectReleaseBundles,
  validateReleaseMetadata,
} from "../tools/build-release-site.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("digest and checksum parsers accept canonical SHA-256 formats", () => {
  const hash = "a".repeat(64);
  assert.equal(parseGitHubDigest(`sha256:${hash}`), hash);
  assert.equal(parseChecksumFile(`${hash}  ${FIRMWARE_NAME}\n`), hash);
  assert.throws(() => parseGitHubDigest(`sha1:${hash}`), /Unsupported/);
  assert.throws(() => parseChecksumFile("not a checksum"), /does not contain/);
});

test("release selection requires bin and JSON while checksum stays optional", () => {
  const asset = (name) => ({ name });
  const releases = [
    { tag_name: "draft", draft: true, assets: [asset(FIRMWARE_NAME), asset(METADATA_NAME)] },
    { tag_name: "missing-json", draft: false, assets: [asset(FIRMWARE_NAME)] },
    { tag_name: "v1.0.0", draft: false, assets: [asset(FIRMWARE_NAME), asset(METADATA_NAME)] },
  ];
  assert.deepEqual(selectReleaseBundles(releases).map((bundle) => bundle.release.tag_name), ["v1.0.0"]);
  assert.equal(selectReleaseBundles(releases)[0].checksum, null);
});

test("release metadata enforces size, hash, and settings boundary", () => {
  const good = {
    project: "DOOM on HuskyLens",
    version: "1.0.0",
    image: FIRMWARE_NAME,
    size: 3,
    sha256: "b".repeat(64),
    flash_address: "0x000000",
    settings_address: "0x7FE000",
  };
  assert.equal(validateReleaseMetadata(JSON.stringify(good), { size: 3 }, "v1.0.0").size, 3);
  assert.throws(
    () => validateReleaseMetadata(JSON.stringify({ ...good, size: MAX_FIRMWARE_SIZE + 1 }), { size: MAX_FIRMWARE_SIZE + 1 }, "bad"),
    /size is invalid/,
  );
  assert.throws(
    () => validateReleaseMetadata(JSON.stringify(good), { size: 4 }, "bad"),
    /does not match/,
  );
  assert.throws(
    () => validateReleaseMetadata(JSON.stringify({ ...good, flash_address: "0x1000" }), { size: 3 }, "bad"),
    /flash address must be 0x000000/,
  );
  assert.throws(
    () => validateReleaseMetadata(JSON.stringify({ ...good, settings_address: "0x800000" }), { size: 3 }, "bad"),
    /settings address must be 0x7FE000/,
  );
});

test("site builder mirrors and verifies a complete release bundle", async () => {
  const firmware = Buffer.from([0x10, 0x20, 0x30]);
  const firmwareHash = digest(firmware);
  const metadata = Buffer.from(JSON.stringify({
    project: "DOOM on HuskyLens",
    version: "1.0.0",
    image: FIRMWARE_NAME,
    size: firmware.length,
    sha256: firmwareHash,
    flash_address: "0x000000",
    settings_address: "0x7FE000",
  }));
  const checksum = Buffer.from(`${firmwareHash}  ${FIRMWARE_NAME}\n`);
  const assets = [
    { id: 1, name: FIRMWARE_NAME, url: "https://api.example/assets/1", size: firmware.length, digest: `sha256:${firmwareHash}` },
    { id: 2, name: METADATA_NAME, url: "https://api.example/assets/2", size: metadata.length, digest: `sha256:${digest(metadata)}` },
    { id: 3, name: CHECKSUM_NAME, url: "https://api.example/assets/3", size: checksum.length, digest: `sha256:${digest(checksum)}` },
  ];
  const releases = [{
    tag_name: "v1.0.0",
    name: "DOOM on HuskyLens 1.0",
    draft: false,
    prerelease: false,
    published_at: "2026-07-15T00:00:00Z",
    html_url: "https://github.com/aztechell/doom_on_huskylens/releases/tag/v1.0.0",
    assets,
  }];
  const bodies = new Map([
    [assets[0].url, firmware],
    [assets[1].url, metadata],
    [assets[2].url, checksum],
  ]);
  const fetchImpl = async (url) => {
    if (String(url).includes("/releases?")) {
      return new Response(JSON.stringify(releases), { headers: { "content-type": "application/json" } });
    }
    const body = bodies.get(String(url));
    return body ? new Response(body) : new Response("missing", { status: 404 });
  };

  const outputDir = await mkdtemp(path.join(tmpdir(), "doom-hl-pages-"));
  try {
    const catalog = await buildReleaseSite({
      repository: "aztechell/doom_on_huskylens",
      outputDir,
      fetchImpl,
      now: () => new Date("2026-07-15T01:00:00Z"),
    });
    assert.equal(catalog.releases.length, 1);
    assert.equal(catalog.releases[0].asset.sha256, firmwareHash);
    assert.deepEqual(
      await readFile(path.join(outputDir, "firmware", `${firmwareHash}.bin`)),
      firmware,
    );
    assert.equal(JSON.parse(await readFile(path.join(outputDir, "releases.json"), "utf8")).schemaVersion, 1);
    await assert.rejects(stat(path.join(outputDir, "test")), /ENOENT/);
    await assert.rejects(stat(path.join(outputDir, "tools")), /ENOENT/);
    await assert.rejects(stat(path.join(outputDir, "package.json")), /ENOENT/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
