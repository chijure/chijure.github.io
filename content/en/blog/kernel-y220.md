---
title: "A 3.4.5 kernel for the Huawei Y220-U05: 26 commits from a donor tree to a stable Gingerbread"
date: 2026-10-23
description: "The Y220-U05 (MediaTek MT6572) runs a kernel taken from a donor tree. This is what had to be fixed, from boot to Wi-Fi, the camera, power-off charging and the hotspot."
tags: [android, kernel, y220, mediatek]
draft: true
---

The **Huawei Ascend Y220-U05** uses a MediaTek **MT6572** and ships with Android 2.3.6 (build `C482B206SP05`). For the CyanogenMod port I needed my own kernel, and the starting point was a **donor** tree from Longcheer for Jelly Bean (`lcsh72_we_jb3`): a Linux 3.4.5 with MediaTek support (its history shows it imported from a Lenovo project in 2014). The donor has a different panel (DSI FWVGA) and different storage (eMMC), while the Y220 has a 320x480 ILI9488 and NAND.

Between 8 and 23 October 2026 I made **26 commits** and built kernels numbered up to `#98` (the number is the build counter). This is what I fixed, kernel side only, and first how I tested it without risking the system.

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

## Timeline

| Kernel | What changed |
|---|---|
| `#7` | First try as recovery: touch does not appear (msg2133 `I2C transfer error`) |
| `#16` | The panel is recognised, but the capacitive keys are missing |
| `#59` | The pinned TWRP kernel, with keys and button backlight |
| `#57` | Stock image boots to the launcher, with keys, speaker, camera and accelerometer |
| `#76` | Wi-Fi starting properly (it turned out not to be a kernel bug, see below) |
| `#90` | NAND partition table, zram, quieter log and camera colours |
| `#91` | The boot logo no longer leaves garbage on the screen |
| `#92` | Camera preview no longer freezes when it is reopened |
| `#93` | Netfilter, for USB tethering |
| `#94` | An interface that allowed reflashing the touch firmware is removed |
| `#95` | A debug `panic()` that hung power-off charging is removed |
| `#96` | IPv6 |
| `#98` | Wi-Fi access point for Android 4.2's `netd` |

## From donor to phone

The first commit registers the ILI9488 panel, drives the **msg2133** touch from GPIO 110 with the Y axis reversed, and enumerates the SD slot without the donor's card-detect interrupt, so a card already inserted at boot is found.

Reaching the launcher with the stock image took more: turning on **Mali UMP** so gralloc can attach buffers, keeping the stock allocator, and returning immediately from the `PerfService` writes that boost the GPU and CPU, because otherwise `ActivityManager` could not finish booting. Then came the keys (volume-down as a keypad column on GPIO 108), the speaker, the **GC0329** camera sensor, the **KXTJ2** accelerometer with its axis map, and USB mass storage (`lun0` and `lun1`, and unmounting the primary card while the second FAT is stacked on top of it).

## Memory and partitions

Two donor mistakes produced symptoms far from their cause:

- **The partition table was an eMMC one.** `dumchar` pointed `/dev/nvram` and the other nodes at nothing, and `ccci_plat` failed in `sec_boot_init` opening `/dev/`. The table is now the stock NAND layout: 18 entries, with the MTD names `seccnfg` and `secstatic`. The modem interface (CCCI) also became modules (`ccci_plat.ko` and `ccci.ko`), as the stock `init.rc` loads them.
- **zram was missing.** The stock `init.rc` creates a 192 MB swap on `zram0`, and this kernel could not build it. I enabled `ZSMALLOC` and `ZRAM`, and turned off `CONFIG_SLUB_DEBUG_ON`, which came from the platform config and debugged every cache.

On top of that, the kernel wrote about **22 lines a second** at idle and `dmesg` rotated within seconds. I moved the per-process, wakelock, battery, key, watchdog and socket traces, among others, to debug level. At idle it dropped to **1.2 lines a second**, and errors are kept.

## Display and camera

- **A driver for the panel.** `ili9488_dbi_dijing`, with the stock sleep-in and sleep-out sequence and without the TE checks that only exist on DSI, so ESD recovery does not kick in on a parallel DBI panel.
- **Boot logo.** The bootloader (LK) draws the logo at 16 bpp at *its own* framebuffer base, passed in the `videolfb` ATAG, which is not the start of the kernel's 32 bpp VRAM. `mtkfb_fb_565_to_8888` converted from the start of the VRAM, so between the logo and the animation the panel showed the previous session's last frame, garbled. It now reads the logo from the LK base.
- **Camera colours.** The sensor sends `Cb Y Cr Y` and the driver declared YUYV, so photos came out green and magenta. I declared it as UYVY, like the stock `GetInfo`, and the `mtkfb` YUV422 overlay as UYVY too.
- **Frozen preview.** With `MTKFB_NO_M4U`, `mtkfb_get_ovl_mva` caches one display address per buffer and nothing cleared it. After reopening the camera the overlay kept reading the previous session's pages and the image alternated between the last frame and black. The address is now freed when the buffer is registered or unregistered, after waiting for the LCD to be idle.

## The `panic()` that slipped in

In power-off charging mode the animation froze and the power key never did anything. The cause was my own log-quieting commit (`2d98770d`): it slipped in a **temporary probe** in `battery_common.c` that armed a timer and called `panic()` 4.2 seconds after the first `BAT_thread`, to dump the console RAM. The restart from timer context hung in `wdt_arch_reset`. Kernel `#95` removes it.

The lesson was to read `last_kmsg` before theorising, and not to leave debug probes inside a clean-up commit.

## Networking

- **Netfilter (`#93`).** The project config had `# CONFIG_NETFILTER is not set`, so no `nat` table, and USB tethering could not do NAT. I used the MT6572 platform set, like the stock kernel. `xt_qtaguid` stays off: Gingerbread does not use it and it needs IPv6.
- **IPv6 (`#96`).** It was off too. Android 4.2 needs it: `NetworkInterface` reads `/proc/net/if_inet6` and, without it, CM10.1 tethering could not set up NAT.
- **WPA2 with `wpa_supplicant` 8.** `mtk_cfg80211_set_default_key()` was a stub returning `-EINVAL`. Android 4.2's `wpa_supplicant` sends `SET_KEY default` after every pairwise key, and every WPA/WPA2 association failed after the four-way handshake. Since `add_key` already marks the pairwise key as the transmit key, returning 0 was enough.
- **Calibration and WPA2 on Gingerbread.** The Y220 NVRAM override was empty and replaced the chip calibration. Also, Gingerbread's `wpa_supplicant` clears WPA with `SIOCSIWENCODE(DISABLED)` and leaves the group cipher at 0, so CCMP networks were rejected.
- **Access point (`#98`).** Android 4.2's `netd` writes `AP` or `STA` to `WIFI_DRIVER_FW_PATH_PARAM` and runs hostapd on `wlan0`. The MT6582 driver only created its AP device (`ap0`) through a private ioctl, and `/dev/wmtWifi` only accepted `0` and `1`. Now `wmt_chrdev_wifi.c` passes `AP`, `STA` or `P2P` to a function the WLAN module registers: in AP mode it renames the station device to `sta0` and registers the AP as `wlan0`. For that, `dev_change_name` is exported to the module.

## Security

The donor touch driver created `ms-touchscreen-msg20xx/update` with **0777** permissions, so any app could reflash the touch firmware. The stock kernel has no such interface and I removed it (`#94`).

## What looked like the kernel and was not

Wi-Fi would not start on Android and `dmesg` pointed at the driver. It was three integration problems: `wlan.ko` was a broken link, MediaTek's HAL does not load its `cfg80211.ko` dependency, and preloading both modules by hand made the HAL fail with `File exists`. It was fixed with the load order in the ramdisk, not in the kernel.

A warning that cost a scare: **every module in `/system/lib/modules/` must be built with the running kernel**. A TWRP restore of the stock `/system` brings back the 2014 modules and the kernel loads them (same `vermagic`, no `MODVERSIONS`), then panics inside `mtk_stp_wmt`.

## A change that did not help

One commit ignores power-key releases with no matching press, but it is in `pmic_mt6320.c`, which the Y220 **does not build**: its PMIC is the MT6323. I noted it in the commit message itself. Moral: before fixing, check that the file you are editing makes it into the binary.

## Building it

```sh
./build.sh y220
```

With the `arm-linux-androideabi-4.6` toolchain. The code is in the [android_kernel_huawei_y220-u05](https://github.com/chijure-android-system-development/android_kernel_huawei_y220-u05) repository, and the device tree in [android_device_huawei_y220](https://github.com/chijure-android-system-development/android_device_huawei_y220).
