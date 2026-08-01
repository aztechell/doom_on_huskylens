import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("site uses a strict same-origin runtime policy", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'self'/);
  assert.doesNotMatch(html, /<(?:script|img)[^>]+src=["']https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:\/\//i);
});

test("release selector replaces local firmware file input", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("src/app.js", root), "utf8");
  assert.match(html, /id="release-select"/);
  assert.doesNotMatch(html, /type="file"|firmware-file|file-drop/);
  assert.match(app, /fetch\("\.\/releases\.json"/);
  assert.match(app, /digest !== state\.release\.asset\.sha256/);
  assert.match(app, /flashButton\.addEventListener\("click", startFlash\)/);
});

test("project artwork is wired without stretching the 4:3 hero", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("styles.css", root), "utf8");
  const hero = await stat(new URL("assets/doom_on_huskylens_loading_320x240.png", root));
  const social = await stat(new URL("assets/social-preview.png", root));
  assert.ok(hero.size > 0);
  assert.ok(social.size > 0);
  assert.match(html, /og:image" content="https:\/\/aztechell\.github\.io\/doom_on_huskylens\/assets\/social-preview\.png"/);
  assert.match(html, /width="320" height="240"/);
  assert.match(css, /\.hero-art img \{[^}]*aspect-ratio: 4 \/ 3[^}]*object-fit: contain/s);
});

test("bundled HuskyLens ISP stub and licenses are preserved", async () => {
  const stub = await readFile(new URL("isp_stub/isp_prog_huskylens.bin", root));
  const webLicense = await readFile(new URL("LICENSE", root), "utf8");
  const stubLicense = await readFile(new URL("isp_stub/LICENSE", root), "utf8");
  assert.equal(stub.length, 17_664);
  assert.equal(
    createHash("sha256").update(stub).digest("hex"),
    "30dd09e36d3b3e4fd912ae0f65f600960598531cd4e13826f2e3cfd3e4b95bb3",
  );
  assert.match(webLicense, /Copyright \(c\) 2026 HLWF contributors/);
  assert.match(stubLicense, /Apache License/);
  assert.match(stubLicense, /Version 2\.0, January 2004/);
});

test("published flasher cannot reuse an obsolete ISP stub from browser cache", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("src/app.js", root), "utf8");

  assert.match(html, /src\/app\.js\?v=[a-f0-9]+/);
  assert.match(app, /isp_prog_huskylens\.bin\?v=\$\{EXPECTED_STUB_SHA256\}/);
  assert.match(app, /cache:\s*"no-store"/);
});

test("Pages workflow deploys only the generated site artifact", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", root), "utf8");
  assert.match(workflow, /release:\s*\n\s+types: \[published, edited, deleted\]/);
  assert.match(workflow, /if: github\.event_name != 'push'/);
  assert.match(workflow, /build-release-site\.mjs --output _site/);
  assert.match(workflow, /path: _site/);
  assert.doesNotMatch(workflow, /path: \.\s*$/m);
});
