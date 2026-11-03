---
title: "USB OTG on the LG L3 (E400): host mode with a software switch"
date: 2026-11-01
description: "The L3's stock kernel already had the USB host. What was missing was mounting the disk and a switch to force host mode, because the micro-USB ID pin does not reach the processor."
tags: [android, usb, e400]
draft: false
---

On the **LG Optimus L3 (E400)** running CyanogenMod 7, a flash drive plugged in through USB OTG works: it mounts by itself and can be read from the phone. This is what it took, compared with the [C660]({{< relref "usb-otg-c660.md" >}}), where there was no way.


## What the phone already had

LG's 2.6.38 kernel already includes the host controller (`msm_hsusb_host.0`), `usb-storage` and a `debugfs` control. The kernel did not need changes. What was missing:

1. **Mounting the disk.** A `usbdisk` entry in `vold.fstab` pointing at `/devices/platform/msm_hsusb_host.0`, mounting the drive at `/mnt/usbdisk`.
2. **A switch.** The micro-USB ID pin **does not reach the processor** (the `OTGSC` register always reads 1), so the phone never enters host mode by itself. It has to be forced.

## The switch

The kernel accepts the mode in `/sys/kernel/debug/otg/mode`. I tied it to a system property (`sys.otg.mode`) through `init.e0.rc`, and wrote a small app, **OtgSwitch**, with a button that flips it between `host` and `peripheral`. It runs as the system user because only that user may write the property.


## How to use it

1. Open OtgSwitch and turn host mode on **before** plugging the cable.
2. Connect the OTG adapter and the flash drive.
3. The disk shows up at `/mnt/usbdisk`.
4. To go back, turn host mode off: adb and USB charging return.

## Which adapter I used

A **90° micro-USB OTG adapter** ([Mercado Libre listing](https://www.mercadolibre.com.pe/adaptador-micro-usb-otg-90-grados-derecho/up/MPEU2463941096)).


## Limits

- **The phone does not supply 5 V.** The connected device needs external power.
- Host mode disables VBUS and ID detection and is **lost on reboot**.
- With host mode on, the USB port is no good for adb: use adb over Wi-Fi (`setprop service.adb.tcp.port 5555`).
- A mouse and a keyboard show up as ordinary input devices. I tested the mouse on a CM10.1 build.

The code is in the [device tree](https://github.com/chijure-android-system-development/android_device_lge_e400) and the app in [OtgSwitch](https://github.com/chijure-android-system-development/android_packages_apps_OtgSwitch).
