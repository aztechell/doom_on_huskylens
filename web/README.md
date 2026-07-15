# DOOM on HuskyLens web flasher

This isolated MIT-licensed component installs verified project releases through
Web Serial. It is based on HLWF, but replaces local file selection with a
release catalog generated during the GitHub Pages deployment.

## Release contract

An installable release contains:

- `doom_huskylens.bin`;
- `doom_huskylens.bin.json`, containing matching `size` and `sha256` fields;
- optionally, `doom_huskylens.bin.sha256` for human verification.

The Pages builder downloads both required assets through the GitHub API,
validates the JSON metadata, checks every available GitHub asset digest, and
recomputes the firmware SHA-256. It publishes the verified binary under its
content hash and writes a same-origin `releases.json` catalog. The browser
recomputes SHA-256 once more before enabling the flash button.

The maximum raw firmware size is `8,380,379` bytes: the protected settings
boundary at `0x7FE000` minus the 37-byte K210 DIO wrapper.

## Local checks

```powershell
npm test
```

`build:site` normally runs inside GitHub Actions and uses `GITHUB_REPOSITORY`
and `GITHUB_TOKEN`. Its generated `_site` directory and mirrored release
binaries are deployment artifacts, not source files.

Pushes that touch `web/` run the test job only. Publishing, editing, or deleting
a release rebuilds and deploys Pages; `workflow_dispatch` provides an explicit
manual refresh. This avoids two different Pages artifacts competing for the
same source commit.

Use desktop Chrome or Edge over HTTPS. They are the tested browsers for this
installer; support in other browsers is outside the release contract.
