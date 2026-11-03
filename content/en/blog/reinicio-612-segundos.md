---
title: "A reboot at exactly 612 seconds"
date: 2026-10-31
description: "The LG L3 with a 3.4 kernel reboots on its own, with no panic, always between 609 and 616 seconds of uptime. With the 2.6.38 kernel and the same ramdisk, it does not happen. This is what I ruled out and what is still open."
tags: [android, kernel, e400]
draft: false
---

Porting {{< g "cm" >}} 10.1 to the **LG Optimus L3 (E400)** with a 3.4 {{< g "kernel" >}} (instead of the 2.6.38 that already worked) brought a failure I had not seen before: the phone reboots on its own, with no {{< g "panic" >}} and no oops in the log, almost always between **609 and 616 seconds** of uptime. It happens even at full idle, with the screen off. After the reboot, the bootloader comes up in charging mode.

## The result that pins it down

| Test | Result |
|---|---|
| 3.4 kernel (any variant I tried) | falls at 609–616 s, every time |
| 2.6.38 kernel + CM9's {{< g "ramdisk" >}} | 1,480 s without falling |
| 2.6.38 kernel + the **same CM10.1 ramdisk** the 3.4 uses | 1,850 s (30 min) without falling |

The third row is the one that matters: with the same userspace, the same Wi-Fi, the same Bluetooth and the same modem, changing only the kernel decides whether the phone falls or not. **It is not a CM10.1 problem, not the hardware, and not the modem.**

## What I ruled out

I tested, one at a time and combined, the most obvious explanations, and none of them changed the result:

- **Charger or USB.** With the cable unplugged and adb over Wi-Fi, it still falls.
- **Audio and the audio DSP.** Same AMSS firmware on both kernels, same `rpc_server_dog_keepalive`.
- **Deep idle.** I turned it off entirely (`idle_enabled` at 0, `nohlt` on the command line).
- **Wi-Fi and Bluetooth, separately.** On, off, scanning: no change.
- **Build options unique to the 3.4 kernel**, turned off one at a time and then all eleven together: no change.
- **The reboot reason code** (`boot_reason=32`) is not a clue: it also shows up on a normal boot with USB plugged in.

## What is still open

None of the above explains the fall, but a few leads remain:

- The timing is **almost fixed**: 613.6 s is, almost exactly, 2³² divided by 7 MHz. It may be a coincidence, but I did not rule it out: it would take comparing how each kernel counts time (`arch/arm/mach-msm/timer.c`) between the 3.4 and the 2.6.38.
- One inter-processor channel (channel 38, called `DAL00`) stays open with traffic on the 3.4 kernel and closed on the 2.6.38. It was opened by the analog-to-digital converter driver; turning it off changed nothing, but another client of that channel might exist.
- The last event I saw before several falls was remote storage writing and Wi-Fi re-associating, 15 to 55 seconds before the reboot.
- I searched online for the same issue (MSM7225A, 3.4 kernel, reboot at ~10 minutes) and found no matching case. Only general material on this chip family's watchdog and old patches for timer overflow.

## Why I left it here

I had three paths: keep comparing the 3.4 against the 2.6.38 file by file (each test takes about 11 minutes), port Android 4.2.2 on top of the already-stable 2.6.38 kernel, or leave it as a **known issue**: today the phone reboots on its own every 10 minutes and comes back to Android without anyone touching it.

I chose the third. The phone is usable this way, and chasing timer bits further on nothing stronger than a numeric coincidence was not worth the time. If anyone recognises this pattern on another MSM7225A with a 3.4 kernel, or knows what changed between 2.6.38's `timer.c` and 3.4's on this platform, I would like to hear about it.

This port's code is in the [device tree](https://github.com/chijure-android-system-development/android_device_lge_e400) (`jellybean` branch) and the kernel is in the [lge-kernel-lproj](https://github.com/chijure-android-system-development/lge-kernel-lproj) fork, branch `android-msm-3.4-jb4.2-e0`.
