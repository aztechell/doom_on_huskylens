# DOOM on HuskyLens 1.0

Turn the original DFRobot HuskyLens K210 camera (`SEN0305`) into a tiny,
standalone DOOM console. No soldering or hardware modification is required.

## Highlights

- Native 320×200 DOOM rendering on the 320×240 HuskyLens display.
- FAT32 microSD support for `DOOM.WAD`, `FREEDOOM1.WAD`, and
  `FREEDOOM2.WAD`.
- A startup game picker with one-minute display sleep and button wake.
- Four-button controls for movement, firing, use, weapon switching, menus,
  backward movement, and jumping.
- Browser-based installation from verified GitHub Release assets through Web
  Serial, plus a reproducible command-line flasher.
- Audited GPLv3 firmware source with pinned SDK, engine, and flasher
  provenance.

## Before flashing

- This release targets the original HuskyLens K210 model, SKU `SEN0305`. It is
  not intended for HuskyLens 2.
- The port is intentionally soundless.
- Flashing replaces the firmware currently installed on the device.
- Commercial DOOM data is not included. Supply a legally obtained `DOOM.WAD`
  or use the free Freedoom IWADs on a FAT32 microSD card.

## Release files

- `doom_huskylens.bin` — firmware image, 1,470,776 bytes.
- `doom_huskylens.bin.json` — machine-readable version and flash metadata.
- `doom_huskylens.bin.sha256` — checksum for independent verification.
- `kendryte-standalone-sdk-02576ba-source.tar.gz` — exact pinned Apache-2.0
  SDK source used to build the statically linked firmware.

Firmware SHA-256:

```text
938bdaee16fc520e8f4eab48ceedafb969517ca44c63597a8b14fdecb62f8c2f
```

SDK source archive SHA-256:

```text
19f9fd629a1649a35372541f8517cacb4be8dbee94eacd212856196c2af29562
```

Together with GitHub's source archives for the `v1.0.0` tag, the SDK archive
provides the corresponding source identified by the project's GPL audit.

Installation instructions and controls are in the project README. WAD files
are deliberately not part of this release.
