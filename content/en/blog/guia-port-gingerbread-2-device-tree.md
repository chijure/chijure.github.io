---
title: "Porting CM7 to a new phone, 2/3: the minimal device tree that boots"
date: 2026-11-08
description: "Part two: which files a CM7 device tree needs, what goes in BoardConfig.mk, how to extract blobs without losing control, and which Gingerbread traps to expect."
tags: [android, cm7, guide, device-tree]
draft: false
slug: porting-cm7-part-2-device-tree
aliases: [/blog/guia-port-gingerbread-2-device-tree/]
---

Part two of the guide, after the [preparation]({{< relref "guia-port-gingerbread-1-preparacion.md" >}}). The goal here is not to make everything work: it is to make the system **boot**. Everything else is [part three]({{< relref "guia-port-gingerbread-3-bringup.md" >}}).

## The structure

The LG E400's {{< g "device-tree" "device tree" >}} has, among other things, this:

```
device/lge/e400/
├── AndroidProducts.mk      # registers the product .mk files
├── BoardConfig.mk          # hardware, partitions, HAL flags
├── e400.mk, full_e400.mk, cyanogen_e400.mk
├── vendorsetup.sh          # adds the lunch combo
├── recovery.fstab
├── init.e0.rc, ueventd.e0.rc
├── system.prop
├── extract-files.sh, setup-makefiles.sh, proprietary-files.txt
├── kernel                  # prebuilt zImage
├── overlay/, configs/, prebuilt/
├── libcamera/, libaudio/, ril/ ...   # own HALs
└── patches/, docs/, tools/
```

The blobs live elsewhere, in `vendor/lge/e400/`, because they are not yours and should not be mixed with the device tree's code.

## BoardConfig.mk: what decides whether it boots

The values from part 1 go here. From the E400:

```make
TARGET_BOARD_PLATFORM := msm7k
TARGET_CPU_ABI := armeabi-v7a
BOARD_KERNEL_CMDLINE := androidboot.hardware=e0
BOARD_KERNEL_BASE := 0x00200000
BOARD_FORCE_RAMDISK_ADDRESS := 0x01300000
BOARD_KERNEL_PAGESIZE := 4096
BOARD_SYSTEMIMAGE_PARTITION_SIZE := 392167424
TARGET_PREBUILT_KERNEL := device/lge/e400/kernel
TARGET_USERIMAGES_USE_EXT4 := true
```

Then come the graphics and per-HAL flags (`COPYBIT_MSM7K`, `BOARD_USES_QCOM_HARDWARE`, `BOARD_EGL_CFG`, Wi-Fi, Bluetooth, GPS, FM…). **Start with few**. Each flag enables platform code that assumes things about the hardware, and a wrongly chosen flag produces failures that look like they come from somewhere else. Add them when the symptom they solve appears.

`recovery.fstab` and `BoardConfig.mk` must say the same thing about partitions. The E400, for example, mounts `/boot` on `mmcblk0p9`, `/system` on `p14`, `/cache` on `p16` and `/data` on `p21`.

## Blobs: extract with a script, not by hand

`proprietary-files.txt` lists, one per line, the `/system` paths that are needed. `extract-files.sh` pulls them with `adb pull` into `vendor/<vendor>/<device>/proprietary`, and `setup-makefiles.sh` generates `*-vendor-blobs.mk` and `BoardConfigVendor.mk`. That makes the process repeatable: anyone can regenerate `vendor/` from a stock phone.

Two things I learned:

- **Start with the minimal list** and add per symptom. On the E400, `mediaserver` crashed because `libOmxCore.so` and `libmm-omxcore.so` were missing. The log says so plainly.
- **Do not swap framework blobs.** The stock ones were built against a *different* framework: replacing `libsurfaceflinger.so` or `libpixelflinger.so` with the factory ones gave a white screen and then a black one. Blobs are for the hardware layer.

## Registering the product

CM7's `breakfast` flow goes through `AndroidProducts.mk`, `cyanogen_<dev>.mk` and an entry in `vendor/cyanogen/products`. On the E400 I had to create `vendor/cyanogen/products/cyanogen_e400.mk` and its line in that directory's `AndroidProducts.mk`, or `lunch` could not find the product.

And beware of `roomservice`: with `breakfast`, if your repo is not in the local manifest, it tries to fetch CyanogenMod's device tree and may repoint your folder. I prefer `lunch cyanogen_<dev>-userdebug` and `make bacon`, with `USER` and `BUILD_NUMBER` set so the zip is not named `eng..zip`.

## Gingerbread traps at boot

- **`init.rc`**: Gingerbread does not fire `on post-fs-data`. On the E400, `init.e0.rc` used it, `/data/radio` was never created and `qmiproxy` ate 90% of the CPU. With `on post-fs` it works.
- **`system.prop`** does not regenerate `build.prop`: delete it before building after each change.
- **`mka bacon` builds every `Android.mk`** in the tree. One broken app in `packages/apps` breaks your build even if you do not use it.
- **FileManager's ProGuard** fails on `userdebug` (fixed with `-dontwarn android.support.**`).

For environment details, see the [environment article]({{< relref "compilar-cm7-en-2026.md" >}}).

## When to stop

The minimal device tree is ready when: the zip builds, the phone reaches the boot animation and `adb logcat` shows `system_server` alive. Read the logs calmly: almost every failure at this stage is already written there. [Part three]({{< relref "guia-port-gingerbread-3-bringup.md" >}}) is about switching the hardware on, one piece at a time.
