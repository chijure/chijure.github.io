---
title: "xray v1: an X-ray of an Android phone before porting"
date: 2026-11-05
description: "xray collects over adb what you need to know about an Android phone before porting it: SoC, partitions, fstab and kernel. No root, Android 2.2 to 4.2."
tags: [android, tools, adb, xray]
draft: false
slug: xray-v1
---

I buy old phones to port CyanogenMod to them, and each one starts the same way: find out the SoC, the RAM, the kernel, how the partitions are laid out, what the `fstab` mounts, and whether the flash is eMMC or NAND. I used to do it by hand with `adb shell`, and every device answered differently. **xray** does that first pass with one command. It is a Go tool, a single binary for Linux, Windows and macOS, under the MIT license. I tried it on 13 devices running Android 2.2 to 4.2.2.

## What it does

- **X-ray.** Properties, CPU, RAM, screen, GPU, sensors, partitions (MediaTek `dumchar_info`, `/proc/mtd` on NAND or `/proc/partitions` on eMMC), the `init*.rc` files, the `fstab`, packages, radio and kernel. It leaves one folder per device with a `REPORTE.md` (the report, in Spanish) and a global `INDEX.md`.
- **Read-only.** It never flashes or wipes anything. The only thing it writes to the phone is an optional busybox in `/data/local/tmp`, which it removes when done.
- **`xray compare A B`.** Compares two dumps and concludes whether they probably share a device tree.
- **`xray bootinfo boot.img`.** Reads a boot image header and prints `BOARD_KERNEL_BASE`, the page size, the cmdline and the `mkbootimg` offsets.
- **What is missing.** Every report ends with a list of what could not be collected yet for a TWRP, a ROM or a backup.

```text
$ xray -busybox ./busybox-armv7 -pull-system
[xray] Equipo: LGE LG-P500
[xray] Busybox cargado en /data/local/tmp/xray (se borra al terminar).
[xray] AVISO: sin root, se omiten datos protegidos.
[xray] Copiados 3 archivos init/fstab
[xray] Configuracion del kernel guardada (raw/kernel_config.txt).
[xray] AVISO: 6 rutas sin permiso omitidas (raw/pull_skipped.txt).
```

Output shortened, and the messages are in Spanish. With `-pull-system` it pulls `/system` without root and proposes a list of blob candidates.

## What real devices taught me

The tool was first written against the documentation and then corrected against the phones. These are the failures that only showed up once I plugged them in.

**The old toolbox has no `head`, `uname` or `wm`.** Six commands returned nothing but "not found". Line trimming now happens on the PC, and error messages are kept apart from the data. For everything else, `-busybox` pushes a static binary to `/data/local/tmp`. I avoid `/sdcard` because it is usually mounted `noexec`.

**`adb pull` stops at the first "Permission denied".** Pulling `/system` without root stalled at 74%. It now copies entry by entry and, when a directory fails, pulls its files one by one and records the skipped ones.

**busybox's `ls` prints ANSI colors.** With an old adbd the shell uses a pseudo-terminal, and file names arrived with escape codes that broke `adb pull`. They are stripped in one place.

**Labels that mislead when comparing.** Two devices with `ro.board.platform=msm7k` can have different CPUs (ARMv6 against ARMv7). A Y330 declares `mtk` and a Y321 declares nothing. `msm7x27a` and `msm7627a` are the same family. And a `/proc/mtd` with only the header is eMMC, not NAND.

**Android 2.3 does not accept `pm list packages -s`.** System and user packages are now split by the APK path, which works on any version.

## What the comparison showed

These results come from real devices connected over USB.

| Pair | Result |
|---|---|
| Huawei Y320 and Y321 | Same platform (MT6572) and 18 of 20 partitions identical. Only the split changes: `android` goes from 750 to 950 MB and `fat` from 1530 to 1330 MB, with the same total. All init files are identical. |
| Huawei Y200 and Y210 | Same SoC, but the NAND block is 128 KB on one and 256 KB on the other. yaffs2 images and `mkfs` parameters cannot be shared. |
| LG P350g and P500 | Both ARMv6 with the same NAND block. Four partitions change size with the same total. RAM differs a lot: 180 MB against 428 MB. |
| Huawei Y330 and Y321 | Same platform, but the Y330 has a 192 MB `cust` partition and a different map. The tree cannot be reused as it is. |

I checked `bootinfo` against the `BoardConfig.mk` files I already had. On a Y210 the cmdline, the `0x00200000` base and the 4096 page size matched. On a Y220, the `0x10000000` base and the 2048 page size did.

## What it does not do

- It does not provide the kernel source. You have to look for the manufacturer's GPL release.
- Without root it cannot extract `boot.img` or `recovery.img`, and on eMMC LGs the partitions show up by number only. With root, `--pull-boot` dumps them. Without root you can feed the factory firmware images to `bootinfo`.
- The blob list is a filter by folder and name. Review it by hand.
- The Windows and macOS binaries build, but I have not tested them on those systems. That is the first thing I would like someone to verify.
- No report guarantees that a port will boot. It says what is known and what is missing.

## Similar tools

I searched GitHub before publishing and found nothing that does the same, although some cover parts of it:

- [twrpdtgen](https://github.com/SebaUbuntu/TWRP-Device-Tree-Generator) generates a TWRP device tree from a `recovery.img`. It complements xray, which supplies the image and the data. Its documentation mentions Android 4.4 to 12, so it may not work on 2.x devices.
- [android-partition-backup](https://github.com/HollowAOSP/android-partition-backup) dumps partitions, but needs root and assumes `by-name`.
- The `extract-files.sh` scripts in CyanogenMod device trees, like [this one](https://www.github.com/CyanogenMod/android_device_sony_common/blob/cm-14.1/extract-files.sh), copy blobs from a hand-written `proprietary-files` list.

## Download and license

The code and the binaries will be published on [my GitHub](https://github.com/chijure). The code is MIT. The optional busybox is GPLv2 and is not covered by that license: use your own with `-busybox PATH` or get its source at [busybox.net](https://busybox.net/).

If you try it on a device that is not listed here, I want to hear which command returned something empty or odd. Almost every fix in this version came from a new phone that answered differently.
