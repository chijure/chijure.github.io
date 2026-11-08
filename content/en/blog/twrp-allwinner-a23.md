---
title: "A TWRP for an Allwinner A23 tablet with no original firmware"
date: 2026-11-08
description: "The Advance SP6446 lost its original firmware. I backed up the NAND without writing to it, built a TWRP around its own kernel and flashed it with verification."
tags: [android, allwinner, twrp, a23]
draft: false
slug: twrp-for-allwinner-a23
aliases: [/blog/twrp-allwinner-a23/]
---

The **Advance SP6446** is a 7-inch tablet with an Allwinner **A23** (the `sun8i` family), 1 GB of RAM and an 800×480 screen. Its owner, which is me, had lost the original firmware and at some point flashed the one from an **Inet T-708+**. That is why the system introduces itself as Inet while the hardware is the SP6446's. I could not find the original firmware anywhere, so the goal changed: **build a TWRP of my own and keep a reliable backup** of what runs today.

That it is an A23 is a deduction: the build name contains `A23_86DZ`, and an `INet-86DZ` board of type `allwinner,sun8i-a23` exists in Linux's device tree. I did not confirm it by opening the tablet.

## The X-ray first

I ran [xray]({{< relref "xray-radiografia-android.md" >}}) with root. The facts that matter:

- Android 4.2.2, {{< g "kernel" "kernel" >}} 3.4.39, `ro.secure=0`: adb enters as root.
- **1 GB of physical RAM**, yet `MemTotal` reports about 906 MB. `/proc/iomem` declares a System RAM block of `40000000-7fffffff`, exactly 1024 MB. The gap is roughly 118 MB that the kernel reserves (display, video and GPU, as I deduce; the `dmesg` did not keep the breakdown).
- Named partitions on the {{< g "nand" "NAND" >}}: `boot-resource`, `env`, `boot`, `system`, `data`, `misc`, `recovery`, `cache`, `databk`, `private` and `UDISK`, from `nanda` to `nandk`.

## The backup: read-only, and not everything

My rule was to **write nothing to the tablet**, not even a temporary file: `/sdcard` lives on the same NAND. Every partition goes over USB straight to the PC.

The adb of an Android 4.2 does not support `exec-out`, and the tablet's `busybox` has no `nc`. What worked was `adb pull /dev/block/nandb`: on a 16 MB partition the size was exact and the md5 matched the one the tablet itself computed. That confirmed the method, and I ran the rest.

My first plan was 7 GB. I corrected it once I looked at the numbers: **4.6 GB was just `UDISK`**, the user storage, which is not firmware. I also dropped `cache` and `data`. That left **8 partitions and 957 MB**, each hash-verified against the tablet's. Two slips of mine: my script called `md5sum`, which the tablet lacks (it has `md5`), so it printed "DIFERENTE" for data that was fine; and a badly written `pkill` killed my own command.

## What the stock recovery contains

I opened the stock `recovery.img`. It is a standard Android image with the **same 7.6 MB kernel as `boot.img`**, and its ramdisk loads ten `.ko` modules in a specific order: `nand`, the touch drivers, then `disp` and `lcd`. The TWRP tree needs that same order. There is no source for this kernel, so I used it as a prebuilt, together with its modules.

## The TWRP

I created `device/allwinner/a23` in a TWRP 3.1.1 tree with an omni 4.4 base. The values come from the tablet: boot base `0x40000000`, 2048-byte pages, the stock cmdline and the partitions as direct nodes (`/dev/block/nandX`).

I build in an Ubuntu 12.04 container on Docker Desktop. It runs on real x86 CPU, with no emulation, though inside the lightweight virtual machine Docker Desktop uses.

The screen was the open question. The framebuffer is **800×480 landscape, 32-bit** and double-buffered. Instead of guessing the pixel format, I flashed the recovery, copied `/dev/graphics/fb0` and turned it into a PNG. The colours were right with `BGRA_8888`. The touch controller is a **GSL1688E**: the kernel tries `ft5x` and `ft5402` (they fail over I2C, as expected) and detects `gslX680new` at address `0x40`. `recovery.log` and `dmesg` only show board warnings that the stock firmware has as well.

## Flashing without surprises

The procedure: push the image to `/dev` (which is RAM), check its hash there, `dd` only to `nandg`, then read the partition back and compare. I did not try a direct `adb push` onto the block node, as a precaution. One detail: the tablet's `md5` does not read from a pipe, so the final check used `busybox md5sum`.

## Brightness

TWRP needed a brightness path and had none. The stock Android does not use sysfs: its lights module only mentions `/dev/disp` in its strings, so I assume it goes through `ioctl`. But the `disp` driver exposes `/sys/class/disp/disp/attr/lcd_bl`, which read 197. I wrote 60, waited a few seconds and put 197 back: the screen dimmed. I set that as `TW_BRIGHTNESS_PATH`, with a maximum of 255 and a default of 197, and flashed the new image with the same procedure.

With the new recovery, `recovery.log` says `Found brightness file at '/sys/class/disp/disp/attr/lcd_bl'` and `Setting brightness control to 197`, and the *Settings* slider changes the screen brightness. The `Unable to locate brightness file` warning is gone.

## The mistake that cost the battery

The tablet was at 5–9% when I flashed, and my script printed `0 Charging` and carried on. Then I rebooted into recovery and it ran flat. The write had been verified before the reboot and the tablet booted fine afterwards, but it was careless. In TWRP the sysfs `capacity` reads 0 and is useless: you have to look at `voltage_now` (3.5 V is about 5–10%) or read the battery from Android. The script must now **abort** on a low level, before `dd` and before the reboot.

## Where it stands

- Working: recovery boots, adb, screen and colours, touch, **brightness control**, mounting `/system`, `/data`, `/cache` and internal storage.
- Untested: the microSD and backups of `data` and `system`.
- I did not recover the SP6446's original firmware. What exists is the verified backup of what runs today.
