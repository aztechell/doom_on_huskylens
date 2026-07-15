<div align="center">

<h1>DOOM on HuskyLens</h1>

<img src="firmware/assets/doom_on_huskylens_loading_320x240.png"
     alt="DOOM on HuskyLens" width="640">

<p><strong>Turn a HuskyLens into a tiny standalone DOOM console.</strong><br>
No soldering. No hardware mods. Add a microSD card, flash the firmware, and play.</p>

</div>

DOOM on HuskyLens is made for fun first: a clean game picker, instant boot,
simple four-button controls, and the full classic game running directly on the
device. It is completely standalone after installation and does not need a PC
to play.

> [!NOTE]
> This port is intentionally soundless. Flashing replaces the firmware
> currently installed on your HuskyLens.

## What you need

- a HuskyLens;
- a FAT32-formatted microSD card;
- a USB cable and a Windows PC with Python 3.10 or newer;
- a legally obtained `DOOM.WAD`, or a free Freedoom IWAD;
- the latest `doom_huskylens.bin` release.

The original commercial DOOM data is not included.

## Install in three steps

### 1. Prepare the microSD card

Create a folder named `DOOM` in the root of the card and copy at least one of
these files into it:

```text
/DOOM/DOOM.WAD
/DOOM/FREEDOOM1.WAD
/DOOM/FREEDOOM2.WAD
```

Names are case-insensitive. You can install all three and choose one whenever
the device starts.

### 2. Prepare the installer

Download and unpack this repository, then open PowerShell in its folder. Run
these commands once:

```powershell
py -m pip install pyserial
py tools/bootstrap_deps.py --flash-only
```

The flash-only setup downloads one small, pinned installer file and verifies
its checksum. It does not require Git and does not download the compiler or
firmware SDK.

### 3. Flash and play

Connect the HuskyLens, place `doom_huskylens.bin` in the project folder, and
run:

```powershell
py tools/hkflash.py flash .\doom_huskylens.bin
```

The correct USB serial port is normally detected automatically. If several
serial devices are connected, specify it explicitly:

```powershell
py tools/hkflash.py flash .\doom_huskylens.bin --port COM10
```

Insert the prepared microSD card and restart the HuskyLens. Choose a game with
`LEFT` or `RIGHT`, then press `OK`.

> [!TIP]
> The game-selection screen turns itself off after one minute without input.
> Press any button to wake it; your current selection is preserved.

## Controls

### Game

| Action | Controls |
| --- | --- |
| Turn | `LEFT` / `RIGHT` |
| Move forward | Hold `OK` |
| Move backward | Quickly tap `OK`, then press it again and hold |
| Fire | `BACK` |
| Open a door / use a switch | Hold `OK`, tap `BACK` once |
| Jump | Hold `OK`, double-tap `BACK` |
| Next owned weapon | Hold `BACK + RIGHT` |
| Open or close the DOOM menu | Hold `BACK + OK` |

### Menus

| Action | Controls |
| --- | --- |
| Previous / up | `LEFT` |
| Next / down | `RIGHT` |
| Select | `OK` |
| Open / close or go back | Hold `BACK + OK` |

## Quick troubleshooting

- **No game is found:** check that the card is FAT32 and the file is inside
  `/DOOM/` with one of the supported names above.
- **The game picker is black:** it has gone to sleep; press any button.
- **No serial port is detected:** reconnect the USB cable and run
  `py tools/hkflash.py list`.
- **Flashing cannot enter boot mode:** close other serial tools and retry with
  the HuskyLens connected directly to the PC.

## For developers

The main page deliberately keeps engineering details out of the way:

- [building and testing](docs/DEVELOPMENT.md);
- [advanced flashing and UART monitoring](docs/FLASHING.md);
- [license and source provenance audit](docs/GPL_AUDIT.md);
- [verified release results](docs/VERIFICATION.md).

## License and names

The combined firmware is released under GNU GPL version 3. Third-party
components retain their notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
WAD files are separate game data and are not distributed here.

DOOM is a trademark of id Software/ZeniMax. HuskyLens is a DFRobot product.
This independent compatibility project is not affiliated with or endorsed by
id Software, ZeniMax, or DFRobot.
