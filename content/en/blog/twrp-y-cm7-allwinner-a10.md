---
title: "A TWRP and a CM7 for an Allwinner A10 tablet, with GPU and sensors"
date: 2026-11-10
description: "BRONCHO PAD703 (Allwinner A10): a TWRP on the stock kernel and a CyanogenMod 7 that boots with Mali and an accelerometer. What broke and what is left."
tags: [android, allwinner, a10, twrp, cm7, gingerbread]
draft: false
slug: twrp-and-cm7-for-an-allwinner-a10-tablet
aliases: [/blog/twrp-y-cm7-allwinner-a10/]
---

The **BRONCHO PAD703** is a 7-inch tablet with an Allwinner **A10** (the `sun4i` family, Cortex-A8, Mali-400 GPU), an 800×480 screen and a stock Android 4.0.3. `MemTotal` reads about 306 MB although the board has 512. adb gives me root, and that changed everything: I could **measure** almost every claim instead of assuming it. This article follows the road to a TWRP and a CyanogenMod 7 ({{< g "gingerbread" "Gingerbread" >}}) that boot on it, with what works and what does not.

## NAND map, and backups first

The {{< g "nand" "NAND" >}} splits into `nanda` through `nandj`: `nanda` is a 16 MB FAT holding `script.bin` and U-Boot, `nandb` is the U-Boot environment, `nandc` is `boot`, `nandd` is `system` (256 MB), `nande` is `data`, `nandf` is `misc`, `nandg` is `recovery`, `nandh` is the cache, `nandi` is an `/oem` and `nandj` is user storage. Before writing anything I copied `nanda`, `nandb`, `nandc`, `nandf` and `nandg` to the PC, with a `sha256` for each.

One method trap: Android 4.0's adb has no `exec-out`, so each partition is first copied to user storage (`nandj`, not to the system partitions) and pulled with `adb pull`.

## The TWRP: a kernel that already worked

Stock `boot` and `recovery` carry **the same** `zImage` (Linux 3.0.8). I reused it as is, and with `--base 0x40000000` the regular `mkbootimg` reproduces the original header, no special tools. The rest came down to measured details:

- **Touch.** `ft5x_ts` is a `.ko` module that Android loads from `/system`. A recovery has no `/system`, so it goes inside the ramdisk.
- **Colour.** `fb0` is 800×480 at 32 bpp, and `BGRA_8888` was right the first time.
- **Brightness.** There is no `/sys/class/backlight`. I disassembled Android's `lights.sun4i.so` and saw it does an `ioctl` `0x142` on `/dev/disp` with `{0, brightness, 0, 0}` (Allwinner's kernel `DISP_CMD_LCD_SET_BRIGHTNESS`). I patched TWRP to use it when the device asks, and the brightness control works.
- **Rebooting to recovery.** U-Boot **ignores** the argument of `reboot()`: neither `adb reboot recovery` nor TWRP's own menu got in. It only looks at the `misc` partition. You have to write the {{< g "bcb" "boot message" >}} (`boot-recovery` at offset 0 and `recovery\n` at offset 64, 1088 bytes) before rebooting. TWRP runs `/sbin/rebootrecovery.sh` if it exists, and that is where it goes. It works, and TWRP clears the message at boot so there is no loop.
- **With buttons.** `script.bin` says `[recovery_key] key_min=8 key_max=20`. Reading the keyboard ADC register (`0x01C2280C`) while pressing, **volume up reads 18** (inside the range) and volume down reads 24–25 (the factory-mode range, 21–30). With the tablet off: volume up plus power. I confirmed it by booting.

A TWRP backup and restore tested for real: `boot` and `cache` restore with the `sha256` of `nandc` identical to the original, and the restored `system` booted the factory Android again.

## The CM7: what kept failing, in order

The device tree (`device/allwinner/a10`) uses the stock kernel and the stock blobs. It builds first time, but it **did not boot**, and every layer had a different cause that could be demonstrated:

1. **SurfaceFlinger crashed in a loop.** Android 4.0's `libUMP.so` imports `__popcount_tab`, a symbol ICS's libc exports and Gingerbread's does not. Worse: Gingerbread's `libui` does have it, but Gingerbread's linker **only searches a library's direct dependencies**, and `libUMP` does not depend on `libui`. I provide it from `libcutils`, which is a direct dependency, with a 256-byte table I checked byte for byte against ICS's.
2. **ICS data in `/data`.** The contacts provider found a version 625 database and could not downgrade to 353. `data` must be wiped when switching Android versions (I took a verified backup first).
3. **Dalvik memory.** Without `dalvik.vm.heapsize` the limit was 16 MB and `system_server` died decoding the wallpaper.
4. **`SystemUI` in a crash loop.** The code looked up a resource under one identifier and the APK had it under another: `out/target/common` is a cache shared between devices, and classes from another build were left in it. Deleting those intermediates fixed it. I caught it by comparing identifiers with `aapt` instead of trusting "it builds without errors".
5. **The GPU.** This was the most delicate work. The tablet's kernel driver is **Mali r2p4-02rel0**. The stock userspace libraries are r2p4, but the ones I found in a public Gingerbread tree are **r2p2**: they do not match the kernel. I used the stock ones (with the fix from point 1). In this Gingerbread, `egl.cfg` is `0 0 android` (software) and `0 1 mali` (hardware). SurfaceFlinger went from *Android PixelFlinger* to **Mali-400 MP, OpenGL ES 1.1**, and the interface feels smoother (my impression, not measured).
6. **CheckJNI.** An `eng` build enables it and slows Dalvik down. The `userdebug` variant fails in ProGuard on someone else's app, so I turn it off with `dalvik.vm.checkjni=false`, which `AndroidRuntime` gives priority.

## Sensors: the chip was not what the stock claimed

Stock Android loaded three accelerometer drivers and the `dmard06` one registered an input device. But reading the I²C bus directly, at the DMARD06's address (`0x1c`) **nothing answers**; at `0x4c` an accelerometer answers with exactly an **MMA7660**'s register map. With `mma7660.ko` loaded before `system_server` and the stock HAL, screen rotation works (it takes a moment, which is normal in Gingerbread). One detail that cost me a reboot: after an `rmmod` of that module while the sensor was in use, the tablet restarted on its own. I did not prove the cause, but **I no longer unload it live**.

## No Bluetooth, no SIM: what is surplus

`script.bin` says `bt_used = 0` and the Wi-Fi is a Realtek over USB, not a combo chip. Reading the code I saw that Android only removes Settings' Bluetooth switch when there is no service, but **leaves the** "Bluetooth settings" entry. I made a small patch in `SystemServer` and in Settings, off by default so other devices are untouched. I checked that the service no longer exists at boot, but **I have not looked at the Settings screen**. The `Mms`, `VoiceDialer` and `Bluetooth` apps are optional and cannot be removed with `filter-out`, because `inherit-product` resolves the lists later: you need a base product of your own that does not include them. And the Home, Menu and Back buttons show up in the status bar thanks to the "Tablet tweaks" feature CM7 already ships (three resources turn it on).

## Wi-Fi: the real state

I leave this part clearly marked as **unfinished**. The Realtek `8192cu` module loads, but on CM7 the USB dongle is never enumerated. I ran an A/B test by restoring the factory Android: there it **does** connect, with the same kernel and the same module, so the fault was mine. The stock `libhardware_legacy.so` contains the path `/sys/class/usb_wifi/rtl_wifi/usb_wifi` and the strings `usb_wifi on ..` and `start to isnmod rtl8192cu.ko` (the typo is Allwinner's). From the order of those strings, and because the file reads `1` with Wi-Fi on and `0` on CM7, **I infer the stock routine writes `1` before the `insmod`** and that this powers the dongle; I did not disassemble the function. My stock `wifi.c` did not do it. When I wrote it by hand **after** the `insmod`, the tablet hung.

It is patched now (compiled only if the device defines `WIFI_USB_POWER_SYSFS`) and verified inside the zip, but **I have not tested it on the tablet yet**.

## Two firmwares, or two tablets

The first dump of the tablet said build `20120725`, a kernel from 26 July, with `dmard06` and working Wi-Fi. The TWRP backup was build `20120709`. I have two units and I suspect the dump was from the other one, but I did not check. The differences are in hardware (the accelerometer) and firmware, and adb shows both under the same generic Allwinner serial number.

## Lessons in method

- **Verify inside the zip**, not just "it built without errors". That is how I found three things that looked done: `build.prop`, the leftover apps and the reboot patch.
- **`make` does not track compiler flags.** Changing `CFLAGS` does not rebuild the object: delete the intermediates. After changing properties, `make installclean`.
- **adb over USB stops answering while the tablet sleeps**; I saw it in the log timestamps. A *wakelock* (`/sys/power/wake_lock`) for long tests.
- **Data from another Android version breaks boot.** Verified backup before wiping.
- When something "should" exist and does not, **read the chip directly** before trusting the driver's name.

## Status

| Works (I saw it on screen) | Built and verified, untested | Pending |
| --- | --- | --- |
| Boot, screen, touch | USB Wi-Fi | Audio (stub) |
| Mali GPU, brightness in TWRP | Reboot to recovery from the menu | Camera (stub) |
| Accelerometer and rotation | Bluetooth out of Settings | Screen density |
| Buttons in the status bar | No Messaging or phone apps | |
| Backup and restore with TWRP | | |

The camera is a single `gc0308` sensor (VGA), and audio uses a `sun4i-CODEC` codec with HDMI output. Next up is checking Wi-Fi on CM7, and then audio.
