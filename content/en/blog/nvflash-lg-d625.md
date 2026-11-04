---
title: "The LG G2 Mini doesn't use LK: unlocking a Tegra 4i with nvflash"
date: 2026-11-03
description: "The G2 Mini (D625) is a Tegra 4i, not a MediaTek LK phone: unlocking works differently, with its own low-level recovery mode and flashing tool."
tags: [android, bootloader, tegra, e400]
draft: false
---

The [L5 II, L4 II and L50]({{< relref "parche-lk-mediatek.md" >}}) share MediaTek's {{< g "lk" "LK" >}} bootloader, so one piece of analysis worked, with adjustments, for all three. The **LG G2 Mini (D625)** is a different family inside: an **NVIDIA Tegra 4i**, with its own low-level recovery mode and its own flashing tool. Nothing learned from the LK carried over as-is.

## A chip that boots "empty"

Tegra processors have a mode called {{< g "apx" "APX" >}}: you enter it by holding the volume keys while plugging in USB, and the chip boots with no firmware of its own, waiting for something to upload it over USB. That's a different design from an LK bootloader that's already written to flash and decides on its own whether to boot: here you first have to hand the chip a small RAM program (the "server") before it can do anything else, including reading its own partition table.

That server doesn't have to come from the same phone: one from a different device with the same Tegra 4i, the Wiko Wax, was enough to start the conversation with the D625 and read its real configuration — even though its partition numbers don't match (on the D625 the bootloader sits at partition 5 and recovery at 16; blindly copying the Wiko's numbers would have written to the wrong place).

## Why writing the bytes isn't enough

With MediaTek's LK, the method was finding the signature comparison in the binary and changing its outcome. With the Tegra, that same kind of binary patch is still needed — the signature check has to be located and its result flipped so an unsigned recovery passes — but installing it isn't as simple as writing the patched file to the partition. The Tegra keeps the bootloader's integrity metadata in a separate table ({{< g "bct" "BCT" >}}) that also has to be updated; writing just the binary's bytes without touching that table leaves the chip in an inconsistent state that can make it fall back to a recovery stage or fail to boot at all.

NVIDIA's official tool, {{< g "nvflash" "nvflash" >}}, does both at once: it writes the partition and updates the BCT's hash and signature in the same step. That's why the verified flow for the D625 always uses `nvflash --download … --sync`, never a raw sector write or a hand-edited BCT.

## What's left alone on purpose

One detail that set this apart from the LK: the Tegra has a second boot stage ({{< g "rbl" "RBL" >}}) separate from the one that gets patched ({{< g "ebt" "EBT" >}}), meant as a safety net if the first one fails. The verified method installs the patched EBT but leaves the original RBL untouched, so if something goes wrong with the patch, the chip still has a way back. It's the same "don't bet everything on one partition" logic already seen with using recovery as the first boot target on other phones in this series.

## Result

With the EBT patched, the same device went from booting only a test image with an altered signature to booting its own images: TWRP installed as a permanent recovery, and a kernel built from the published source running from the boot partition. `fastboot getvar unlocked` reports `yes`.

The full analysis — the BCT format, this particular device's partition numbers, and the read-back verification steps before and after writing — is at [lg-d625-tegra-bootloader-patch](https://github.com/chijure-android-system-development/lg-d625-tegra-bootloader-patch).
