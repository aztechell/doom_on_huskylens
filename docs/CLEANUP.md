# Publication cleanup record

On 2026-07-14, 303 files outside the verified DOOM build closure were moved
without deletion to:

`../doom_on_huskylens_dump/publication-cleanup-2026-07-14`

The archive preserves every original project-relative path. It includes the
unused HackyLens applications, camera/QR/UI code, quirc, unused doomgeneric
desktop backends, screenshots and build files, stale architecture notes,
generated Python caches, and the pre-cleanup build output. None of those files
is staged by `tools/build_firmware.py`.

The cleaned tree was rebuilt from scratch. The strict license audit reports
168 engine-closure files with no missing notices and confirms that all staged
copies hash-match the source tree.
