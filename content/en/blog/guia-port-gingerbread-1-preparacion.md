---
title: "Porting CM7 to a new phone, 1/3: what to gather before writing code"
date: 2026-11-08
description: "Part one of a guide to porting CyanogenMod 7 in 2026: stock data, a verified backup, boot.img parameters, partitions and the starting kernel."
tags: [android, cm7, guide, port]
draft: false
slug: porting-cm7-part-1-preparation
aliases: [/blog/guia-port-gingerbread-1-preparacion/]
---

This is the first of three parts on porting {{< g "cm" "CyanogenMod" >}} 7 ({{< g "gingerbread" >}}) to a new phone. The period guides (the best known is the CyanogenMod wiki's *Porting Intro*) are still valid for the general outline. This series covers what I would add after four ports (Huawei Y210 and Y220, LG C660 and E400), especially what changes when you do it in 2026. The build environment is in [another article]({{< relref "compilar-cm7-en-2026.md" >}}).

The parts: **1. preparation** (this one), [2. the minimal device tree]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}) and [3. bring-up and maintenance]({{< relref "guia-port-gingerbread-3-bringup.md" >}}).

## 1. A backup of the stock... that really is stock

Before flashing anything, take a full copy of the factory system: `boot`, `recovery`, `system` and, if possible, the modem partitions. It sounds obvious, but with the E400 the backup I believed to be factory turned out to be **an earlier CM7** (its `/system` said `CyanogenMod-7`, not `lge/e400`). I found out by comparing the backup's `ro.build.fingerprint` with the phone's. Always do it: if the backup is not stock, it is no use as a reference or as a way back.

A real backup also gives you two things you will use throughout the port: the factory **blobs** and the factory **kernel**. It is also worth packaging a restore zip (on the Y220 I made one from the TWRP backup, and tested that it installs and that the stock boots).

## 2. What to read from the phone

With `adb` and the stock running:

- **`/system/build.prop`**: `ro.product.manufacturer`, `ro.product.device` (the codename) and the fingerprint. They give you the folder names and let you check versions.
- **Partitions**: `/proc/partitions`, `/proc/mounts` and the stock `recovery.fstab` if it has one. Note the block device of each mount point and the sizes; they go straight into `BoardConfig.mk`.
- **`boot.img`**: unpack it and write down the kernel base, the {{< g "ramdisk" >}} address, the page size and the command line. On the E400 they are `BOARD_KERNEL_BASE := 0x00200000`, `BOARD_FORCE_RAMDISK_ADDRESS := 0x01300000`, `BOARD_KERNEL_PAGESIZE := 4096` and `androidboot.hardware=e0`. A wrong value here gives a phone that does not boot and does not say why.
- **Image and block sizes**: `BOARD_SYSTEMIMAGE_PARTITION_SIZE`, `BOARD_USERDATAIMAGE_PARTITION_SIZE` and `BOARD_FLASH_BLOCK_SIZE` come from the real partitions.

Keep everything in a notes file per device from day one. I use `docs/<DEVICE>_NOTES.md` inside the device tree.

## 3. The starting kernel

You have three options, from safest to riskiest:

1. **The stock `zImage`**, extracted from the `boot.img`. The least surprising.
2. A kernel from a similar device's tree, built from source.
3. Your own kernel, from the source the manufacturer published.

My experience: **start with the stock one** and change only when you have a measurable reason. On the E400 the kernel in the device tree I had inherited produced a green screen when opening the camera and `mdp_ppp: invalid image` errors. With the stock `zImage` they disappeared (0 of 40 green frames in three runs). It was not a bug in my code: it was a kernel different from the factory one.

I only rebuilt a kernel when it was really needed, as on the C660, where the prebuilt had the physical keyboard disabled at kernel level.

## 4. Recovery first

Before testing a ROM, a reliable {{< g "recovery" >}}. Without one, every bad test is a phone you have to rescue by other means. With a working recovery you `adb push` the zip, install it, and if something fails you restore the backup. How I tested it in each case:

- Y220: I tried each kernel version as a recovery before booting Android ([TWRP first]({{< relref "y220-twrp-primero.md" >}})).
- C660: a {{< g "twrp" "TWRP" >}} that fit in 5 MB ([the story, in Spanish](/es/blog/twrp-5mb-c660/)).

## 5. Choosing where to start

Do not start with an empty tree if one exists for a device with the same SoC. My ports came from forks of device trees for a similar platform (MSM7x27a), adjusted from there. What you should **not** do is inherit blindly: check `BoardConfig.mk`, `init.*.rc` and the blobs against your stock. On the E400, three problems (kernel, `post-fs-data` and OMX blobs) came from trusting the inherited tree.

## Checklist

- [ ] Backup with the fingerprint verified as stock
- [ ] `build.prop`, partitions and `boot.img` parameters written down
- [ ] Stock `zImage` extracted
- [ ] A recovery that boots, mounts and flashes
- [ ] Build container working with a build of a known device

In the next part we move on to the [minimal device tree]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}).
