---
title: "Porting CM7 to a new phone, 3/3: staged bring-up and how to maintain it"
date: 2026-11-08
description: "Part three: switch on graphics, radio, Wi-Fi, camera and audio one at a time with repeatable tests, and keep patches, notes and repos so the port does not rot."
tags: [android, cm7, guide, bring-up]
draft: false
slug: porting-cm7-part-3-bring-up
aliases: [/blog/guia-port-gingerbread-3-bringup/]
---

Third and last part. You now have a [device tree that boots]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}); now the phone has to be *useful*. The rule for this stage is just one: **one piece of hardware at a time, with a test before and another after**.

## The order that worked for me

1. **Graphics** ({{< g "gralloc" >}}, copybit, {{< g "framebuffer" >}}). Without a stable screen you cannot judge anything else.
2. **Radio/RIL** and Wi-Fi.
3. **Camera and video**.
4. **Audio, FM and Bluetooth**.
5. **Details**: charging while off, GPS, USB, rotation.

### Graphics

This is where the most misleading bugs show up, because they look like application failures. Two E400 cases:

- **Stripes when rotating with the sensor.** SurfaceFlinger's screen capture copied `fb0` with 480-byte rows (`xres*bpp`), but `msm_fb`'s real stride is 512. Each row shifted by 32 bytes. The patch uses `line_length` from `FBIOGET_FSCREENINFO`. Before finding that I ruled out copybit, composition bypass and the kernel.
- **Green screen:** it was the kernel in the tree, not the code (part 1).

### Radio and Wi-Fi

- On the E400, the Wi-Fi scan found no networks: `WifiStateTracker` brought `wlan0` down on disconnect and later scans ran with the interface down. The log showed it (`Disabling interface` right after `Scan requested`). Also, `driver_wext.c` must not fail if `SIOCSIWFREQ` returns `EOPNOTSUPP`, or it will not associate.
- A badly wired RIL shows up in the CPU (`qmiproxy` at 90%), not only in the signal.

### Camera

Mine is always the same recipe: a HAL wrapper in the device tree that loads the stock blob with `dlopen` and calls it without touching platform code. On the E400 it worked with correct preview and 2048×1536 photos. The traps were Gingerbread's linker (it resolves few symbols) and the blob's vtable. It deserves an article of its own.

### Audio and FM

The rule here is **compare against the running stock**. On the Y210, the FM radio had no audio after many discarded hypotheses; the cause was a missing `audmgr_enable()` through `/dev/msm_fm` before the audio RPC. It came from capturing the stock's `dmesg` and repeating its sequence.

## Repeatable tests, not by eye

Every fixed piece must be checkable again. On the Y220 I keep `tools/test_y220.sh`, which over `adb` checks by section (zip, boot, display, audio, wifi, bt, fm, sensors, ril, storage, power) and flags what needs a manual test. Two useful checks:

- **The `zip` section:** checks that every `.apk`/`.jar` in the final zip is a valid zip, before flashing.
- **`tools/blobcheck`:** compares the ROM's blobs with the stock ones after each build.

And a habit that saved me hours: **after every change, `adb logcat` and `dmesg`**. After an unexpected reboot, read {{< g "last-kmsg" "last_kmsg" >}} before theorizing. A diagnostic `panic()` that slipped into a commit hung the Y220 after 10 seconds, and the clue was in that log.

## Maintaining the port

A port that boots today breaks in a month if it is not looked after.

### Patches instead of loose edits

Changes that touch shared projects (`frameworks/base`, `external/*`) live in `patches/` inside the device tree, with `apply-patches.sh` and `revert-patches.sh`. My rule, after losing a commit: **every change in a shared project exists as a patch before anyone reverts**. And I prefer to solve hardware differences in the device tree with HALs and shims, leaving the platform patch as a last resort ([why]({{< relref "hals-y-shims.md" >}})).

### Notes and documentation

`docs/<DEVICE>_NOTES.md` with what was tried and discarded, per piece. It is the most valuable thing when you pick the port up three weeks later: it saves repeating diagnoses.

### Repos and publishing

Device tree, vendor and kernel in their own repos with a `gingerbread` branch, small commits and a `README` explaining how to build. Zips go in the repo's releases. If you announce it, link everything from one place.

## Series wrap-up

1. [Preparation]({{< relref "guia-port-gingerbread-1-preparacion.md" >}}): verified backup, stock data, recovery.
2. [Device tree]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}): `BoardConfig.mk`, blobs, product.
3. Bring-up and maintenance (this one).

It is less glamorous than a brilliant patch, but almost all my lost days came from skipping a step on these lists, not from a hard hardware problem.
