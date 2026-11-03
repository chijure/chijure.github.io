---
title: "Testing the Huawei Y220-U05 kernel without risking the ROM: TWRP first"
date: 2026-10-12
description: "Before booting the Y220-U05's Android with my own kernel, I tried every version as a recovery. This is how I built that test bench and what the first kernels taught me."
tags: [android, kernel, y220, twrp]
draft: false
---

The **Huawei Ascend Y220-U05** uses a MediaTek **MT6572** and ships with Android 2.3.6 (build `C482B206SP05`). For the CyanogenMod port I needed my own kernel, and the starting point was a **donor** tree from Longcheer for Jelly Bean (`lcsh72_we_jb3`): a Linux 3.4.5 with MediaTek support (its history shows it imported from a Lenovo project in 2014).

This is the first of two articles. Here I tell **how I tested it without risking the phone's system**; the [second]({{< relref "kernel-y220.md" >}}) has the actual kernel fixes.

## Starting point: there are no sources

Huawei never published the kernel source code for the Y220. Linux is GPL, so that code should be obtainable, but for this model I found nothing: not published by Huawei and not in community repositories. I did not find another hobbyist's tree to use as a base either.

What I did have was the phone, its stock firmware and the binary kernel it ships with. That changed everything:

- **A donor tree.** I had to start from the kernel of *another* phone with the same processor (MT6572), which is not the Y220 and does not match its panel, memory or sensors.
- **The stock kernel as a reference.** Whenever the donor did something differently, I compared it with what the original does: I captured the partitions, properties and `dmesg` from the stock phone and **disassembled the stock kernel image** to see which registers it writes, for example when starting the camera sensor.
- **A lot of trial and error.** Without sources there is no manual: every fix comes from comparing behaviour with the original device. That is why I needed to test kernels without risking the system.

## First in TWRP, not on the ROM

Before touching the phone's Android I wanted a place where a bad kernel would cost nothing. The answer was **TWRP**. The Y220 has two 6 MB partitions, `boot` (`mtd7`) and `recovery` (`mtd8`). I tried the first kernels as *recovery*: a TWRP with the new kernel, written to `mtd8`, while the stock Android stayed untouched in `boot`. If the kernel did not boot, the phone kept its system and going back meant writing another image to recovery. (The first images of this series, from 7 and 8 October, are recoveries.)

Building that test bench was work in itself:

- **A TWRP tree for the Y220** (8 October). The MTK headers come from `mtkbootimg --mtk 1`, and `system`, `data` and `cache` are UBIFS: `ubiattach` mounts them in the stock boot order (`mtd14`, `mtd16`, `mtd15`).
- **An exact 6 MiB limit.** TWRP had to be pruned (only the `en` and `es` languages, no `sgdisk`) and the kernel has to be small. Today the image with kernel `#92` sits 38 KB under the limit.
- **A way of writing that is not obvious.** `dd` to `mtdblock8` only *erases* the partition; you erase with `mtderase` and write with `nandwrite` on `/dev/mtd/mtd8`, and never on `mtd7`.
- **A safety net.** The phone exposes no fastboot. If something broke outside the recovery, the way out was SP Flash Tool v5 on the preloader (never v6, and never *Format All*).

The first kernels made clear why that route was worth it:

- **`#7`** booted, but the msg2133 touch controller failed with `I2C transfer error` and the touch screen never appeared.
- **`#16`** recognised the panel, but had no capacitive keys.
- **`#59`** (9 October) was a full rebuild with the system configuration: it keeps the key lines (Menu, Home and Back) and the button backlight on GPIO 141. It is the kernel I pinned in TWRP.

The conclusion is written in the tree's README: **never drop an untested system kernel into the recovery**. A bad `boot` experiment must not take the recovery down with it, so the recovery keeps a known kernel (first `#59`, then `#92`) and that is what remains to rescue the phone.

With TWRP stable, the workflow was always the same:

1. `adb reboot recovery` and, from there, `flash_image boot` with the new image.
2. `dump_image boot` and compare the md5 sums before rebooting.
3. Install the modules by mounting `/system` from the recovery itself.
4. Always keep the previous `boot`: my folder has a `boot-...-before-...img` for every important change.

TWRP also turned out to be a diagnostic bench. It writes so little log that its `dmesg` keeps the whole boot, and with it I confirmed the addresses behind the boot-logo fix. Restoring the stock backup from TWRP let me do the A/B comparison with the original kernel: that is how I ruled out the kernel as the cause of "emergency calls only". It had its own bugs too: after a big backup or restore, UBIFS could not find a contiguous block of about 248 KB to mount and failed with `Out of memory`; I fixed it with a script that drops the cache when it passes 32 MB.

## What came next

With that test bench in place, the work was fixing the kernel, build after build: panel, memory, camera, power-off charging, Wi-Fi and the access point. All of it, with the commits and the causes, is in [the second article]({{< relref "kernel-y220.md" >}}). The kernels I mention here are the ones in the recovery partition; the code is in the [android_kernel_huawei_y220-u05](https://github.com/chijure-android-system-development/android_kernel_huawei_y220-u05) repository and the TWRP tree in [android_device_huawei_y220](https://github.com/chijure-android-system-development/android_device_huawei_y220).
