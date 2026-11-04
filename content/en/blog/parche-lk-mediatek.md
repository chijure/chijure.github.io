---
title: "One patch, three phones: MediaTek's LK bootloader"
date: 2026-10-17
description: "One LK bootloader patch, with tweaks, worked on three LG phones. The first version seemed fine and left the phone in a boot loop."
tags: [android, bootloader, mediatek]
draft: false
slug: mediatek-lk-patch
aliases: [/blog/parche-lk-mediatek/]
---

The [LG D625](https://github.com/chijure-android-system-development/lg-d625-tegra-bootloader-patch) (Tegra 4i) needed its own unlock path, with `nvflash`. A different group of older LG phones — the **L5 II (E450g)**, the **L4 II (E440g)** and the **L50 (D213)** — share something that sets them apart: the same MediaTek **LK** bootloader, on the same chip family (MT6575 and MT6572). That coincidence is what let one piece of analysis work, with adjustments, for all three.

## The problem it solves

A custom recovery like TWRP or CWM isn't signed by LG. The LK, before booting any image from the `boot` or `recovery` partition, checks that signature, and if it doesn't match, it halts with a "Security Error" and boots nothing. Without disabling that check, there's no way to install your own recovery, short of paying for an unlock tool every time it's needed.

## What it took to find

The bootloader doesn't publish its source, so the work meant disassembling the binary (`uboot_orig.bin`) until finding the exact function that decides whether the phone boots. That function reads a value stored in memory (the device's "security type") and compares it against a bitmask that says which of those types require a valid signature. On the E450g, the type it ships with does.

## Why the first version didn't work

The obvious fix — skipping that whole function — was tried first and looked reasonable, but left the phone in an **infinite boot loop**. The reason had nothing to do with the signature check itself: that same function also initialises a couple of values that another part of the code, much later in the boot sequence, needs to run the kernel. By skipping the whole function, those values stayed empty, the code that boots the kernel read them as invalid, and the LK rebooted on its own.

The version that does work doesn't skip the function: it lets it run so it initialises what it needs, and only changes the outcome of the signature comparison, so the "Security Error" never fires. It's a difference of a few bytes in the binary, but understanding it meant following the code past the point where the problem appeared to end.

## Result, verified on all three devices

| Phone | Chip | Patches | Status |
|---|---|---|---|
| LG L5 II (E450g) | MT6575 | 9, version 7 | Hardware-verified |
| LG L4 II (E440g) | MT6575 | 9, version 1 | Hardware-verified |
| LG L50 (D213) | MT6572 | 2 | Hardware-verified |

The patch count differs between models because, although they share the bootloader family, each has its own compiled binary, with the verification function at a different address and sometimes with slightly different logic around it. The principle — find the signature comparison and let it fail without halting the boot — is the same; the exact byte offset of each patch is not.

The full analysis, with the disassembly and the patch's version history, is published at [lg-e450g-lk-patch](https://github.com/chijure-android-system-development/lg-e450g-lk-patch), along with the scripts that verify the original binary's hash before patching it and the result's hash afterward.
