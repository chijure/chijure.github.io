---
title: "Kernel 3.4 for the LG L3 (E400): from a phone that rebooted itself to CM10.1 with GPS, sensors and camera"
date: 2026-11-03
description: "The LG Optimus L3 (MSM7225A) shipped with a 2.6.38 kernel. Moving it to 3.4 to run Android 4.2.2 was a chain of silent reboots, and almost all of them had the same cause: the modem."
tags: [android, kernel, e400, qualcomm]
draft: false
---

The **LG Optimus L3 (E400)** is a 2012 phone: a Qualcomm **MSM7225A**, a 320x240 screen, 384 MB of RAM (about 299 MB for Android) and a 2.6.38 kernel from the factory. It already ran {{< g "cm" "CyanogenMod" >}} 7 and 9. I wanted to move it to **CM10.1 (Android 4.2.2)** on a **3.4** {{< g "kernel" "kernel" >}}, like its siblings the L5 and L7. This post tells the path and the failures I had to take apart. It continues the [612-second reboot]({{< relref "reinicio-612-segundos.md" >}}), which now has a different ending.

## Starting point

There was no **e0** board for 3.4. I started from TeamHackLG's fork (`lge-kernel-lproj`), which has the vee3, v1, m4 and other boards, all on the same SoC. I created the `e0` board reusing the vee3 one (`MACH_MSM7X25A_E0` selects it to inherit Bluetooth, camera, storage, WiFi and regulator) with its own code in `arch/arm/mach-msm/lge/e0/`. The useful branch was `jb42`: it has {{< g "pmem" "PMEM" >}} (which CM9 booted with) and {{< g "ion" "ION" >}}, while `kk` only has ION. With CM10.1 I ended up using ION for gralloc, the camera and media buffers, as on the L5 and L7.

The method is the usual one when there is no room for error:

- The kernel is built on the PC with `arm-eabi-4.6` (4.4.3 does not work).
- The boot image is repacked with a Python script (v0 format, 4096-byte page), written with `dd` to the `boot` partition and checked with md5. The previous one is backed up first.
- The first thing to boot the 3.4 is the **{{< g "recovery" "recovery" >}}** partition, not the system one. If it fails, the system stays intact. It is the same idea I described with the [Y220 in TWRP]({{< relref "y220-twrp-primero.md" >}}).
- To see what fails I use {{< g "last-kmsg" "`last_kmsg`" >}} and [QApp]({{< relref "qapp-probar-sin-adivinar.md" >}}), LG's test program, which walks through all the hardware.

## The modem explains almost everything

With the 3.4 and the CM9 userspace, the phone booted and rebooted after 35 seconds, with no {{< g "panic" "panic" >}} and nothing in the log. With `rild` (the radio daemon) disabled it was stable: the radio was the culprit. The phone is an MSM: Android's processor and the modem ({{< g "amss" "AMSS" >}}) are two processors that talk over {{< g "oncrpc" "RPC" >}}, and the modem has a habit: **if something does not add up, it resets the whole chip** without warning. I saw it with these triggers:

| What triggered it | Cause | Fix |
|---|---|---|
| Opening the microphone or voice (and, almost certainly, `rild` at 35 s) | The 3.4's audio *endpoint* table uses Qualcomm's identifiers (handset 0, speaker 6). The E400's AMSS uses LG's old ones (handset 6, speaker 0) | Copy the table from the 2.6.38's `board-e0eu-sound.c` |
| Turning on GPS | The modem calls an RPC server on the Android side that the 3.4 does not have | A new server (see below) |
| Every ~10 minutes | Went away after restoring the whole factory firmware | See the end |

### GPS: a missing server

When asked for a fix, the modem calls RPC program `0x30000006` (`misc_apps_apis`) to ask for the country and operator (MCC, MNC, name and country from the `flex` file). LG's 2.6.38 kernel has that server. TeamHackLG's 3.4 does not, and the modem, getting no answer, resets the chip about 10 seconds later. No log, the phone dying silently.

To see it I turned on the router's debug output (`smd_rpcrouter/parameters/debug_mask`) and wrote a minimal Java program that asks for the location through `app_process` as uid 1000 (as root, `LocationManager` rejects uid 0). The fix is in `rpc_misc_e0.c`: a server that registers the program and answers with an empty 532-byte reply (a 24-byte header, two integers and a 500-byte string), the same as the factory kernel sends when there is no `flex` data. Since then GPS opens 30 to 40 second sessions without a reboot, and the whole QApp run passes. The phone also feels more stable, and this server probably covered other odd reboots.

## Sensors: four causes for one symptom

QApp said "no sensors". There were four separate reasons and all four had to go:

1. **Wrong pins.** `board_v3.h` only applied the E0 I2C pins in another variant's block (V7); the V3 block kept the vee3 ones (13 and 35, instead of 49 and 48). The accelerometer and compass did not answer on the bus.
2. **A duplicated line in the defconfig.** `CONFIG_SENSOR_GP2AP` appeared twice and the second said *is not set*. The last one wins.
3. **The proximity sensor was unpowered.** The 3.4 driver had the call that turns it on commented out. On the E400 it is powered by LDO1 of the BU61800 backlight chip.
4. **`sensord`, Bosch's daemon.** It has to run as root (it creates FIFOs in `/data/local/tmp` and writes sysfs attributes) and with `umask 0`, because `init` uses 077 and the FIFOs ended up 0600: `system_server` could not open them and the system saw 0 sensors. `sensord` also looks for the proximity sensor on a fixed I2C bus (`i2c-4`), so I registered that bus before the sensors one.

Result in QApp: accelerometer, compass and proximity are green. The phone has no gyroscope or light sensor.

## Touch keys, WiFi and the rest

- **Back acted as Home.** I had copied the key map from another L3, which has four keys. The E400 has only two: left `MENU`, right `BACK` (`mms128s_ts.c`).
- **Connecting to a WiFi network rebooted the phone.** A *wireless extensions* patch was missing from the built kernel.
- **WiFi itself** only loaded with an L5 `wlan.ko` that had the same {{< g "vermagic" "vermagic" >}} (`-perf-g22f2f4c`) and the same module CRCs; that required turning off kernel tracing (`CONFIG_MACH_LGE_NO_DEBUG_INFO`), which changed the module structure.
- **Bluetooth** with TeamHackLG's `libbt-vendor`, and the radio with the L5's RIL libraries.

## The camera: an ABI mismatch

The camera HAL that CM10.1 uses on this family is a proprietary binary (`vendor-camera.msm7x27a.so`, from TeamHackLG). With it the preview was full of `Cache clean … 0xffffffff` errors. `strace` on `mediaserver` gave the clue: `mmap(NULL, 0, …) = -1 EINVAL`. A zero-size `mmap`.

The cause was a **{{< g "gralloc" "gralloc" >}} ABI** mismatch. The binary expects a `private_handle_t` with 3 file descriptors and reads the buffer size at offset 32 and the offset field at 36. Our gralloc (CM's `display-legacy`) has 2 descriptors: those fields are at 28 and 32. The HAL was reading the `offset` field (0) as if it were the size.

Rebuilding the whole graphics stack with the 3-descriptor layout (gralloc, genlock, HWC and probably the Adreno libraries) was huge and risky work: I had tried it and `surfaceflinger` crashed in a loop. The way out was to **patch the binary**: in the disassembly I found the 9 16-bit `ldr` instructions that read those fields in the preview and recording functions and subtracted 4 from each one's offset (`size` goes from `[r, #32]` to `[r, #28]` and `offset` from `#36` to `#32`). A script checks that each address holds the expected code before writing. With that, 2048x1536 photos come out.

### Video, in three stumbles

1. **An encoder that does not reach 480p.** The only H.264 encoder in the system is the software one, and it fails with `AVCENC_LEVEL_FAIL` at 640x480 and 30 fps. With its default level only QVGA and CIF fit, so I removed the 480p profiles from `media_profiles.xml`. (That file is loaded once in the *zygote*: after changing it you have to restart the framework.)
2. **Video must have the preview's size.** In this HAL the video comes from the same frames as the preview, but it advertises 640x480 as the default video size. The camera wrapper now sets the video size equal to the preview size when the app is about to record.
3. **Buffers of a different size.** The encoder rejected every frame: "input buffers are too small" (460800 vs 462848). 462848 is gralloc's page-aligned buffer size; 460800, the real frame's. The wrapper hands the HAL memory of the exact frame size.

Result: 352x288 H.264 video with audio and the right image. The limit is the software encoder: it is slow and forces CIF.

## The end of the 612-second reboot

The previous post left that reboot as an open problem. After installing the 3.4 with the phone's factory firmware **fully restored** (including the modem and NV data), it **stopped happening** with the same kernel and the same ramdisk. It was not the 3.4's code: the state of that phone triggered it. I do not know which piece exactly changed (restoring the stock rewrites several partitions at once) and I could not reproduce it afterwards, so I consider it closed in practice, not explained.

## What I take away

- **When an MSM reboots with no log, look first at what the modem asks Android for.** The audio and GPS reboots were a question with no answer or with a wrong identifier.
- **Compare with the factory kernel before theorising.** Almost every fix came from reading what LG's 2.6.38 does (the audio table, the RPC server, the pins) and copying it.
- **If a proprietary binary fails on an ABI, a 9-instruction patch is sometimes worth more than rebuilding the world.** But only if you can verify every address.
- **Testing on the recovery partition** saved me from reflashing the system dozens of times.

## Status and code

Working: display, touch with its two keys, WiFi, Bluetooth, audio, GPS, sensors and camera (photos and CIF video). Still to test: the SIM, since I do not have one from the carrier the phone is tied to.

The code is in the kernel fork [lge-kernel-lproj](https://github.com/chijure-android-system-development/lge-kernel-lproj) (branch `android-msm-3.4-jb4.2-e0`) and in the [device tree](https://github.com/chijure-android-system-development/android_device_lge_e400) (branch `jellybean`). The proprietary binaries live in a separate private repository.
