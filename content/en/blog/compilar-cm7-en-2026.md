---
title: "Building CyanogenMod 7 in 2026: the environment and the traps"
date: 2026-11-08
description: "How I build CM7 (Gingerbread) today: an Ubuntu 12.04 container, ccache, one tree shared by four phones, and the problems that cost me more than one build."
tags: [android, cm7, build, docker]
draft: false
slug: building-cm7-in-2026
aliases: [/blog/compilar-cm7-en-2026/]
---

I now have several {{< g "cm" >}} 7 ports that are almost stable: the Huawei Y210, the Y220, the LG C660 and the LG E400. Before writing about each one, here is what they all share: **how you build a 2011 Android on a 2026 machine**, and the traps that each cost me a failed build.

## The environment: a 2012 container

{{< g "gingerbread" >}} does not build with a modern toolchain: it needs `openjdk-6`, the period `gcc-multilib` and Python 2. Installing that on the host would pollute it (and is nearly impossible on a current Ubuntu), so I build inside an **Ubuntu 12.04** container:

- The image points the repositories at `old-releases.ubuntu.com`, because the regular 12.04 mirrors are gone.
- A `builder` user is created with the host's UID/GID, so the mounted tree (`~/cm7`) does not fill up with root-owned files.
- The source, a dedicated ccache directory and some helper objects are mounted. Compose names it `cm7-builder`.

The tree is a normal CM7 `gingerbread` checkout from `repo`, plus my device trees. The build is launched by a script that times it and records the log, the zip size and its md5:

```bash
docker exec -it cm7-builder bash -c 'DEVICE=y210 ./timed_build.sh'
# breakfast → lunch cyanogen_y210-eng → mka bacon
```

Even so, 2011 code needs tweaks to build on today's host (headers, `javac -source 1.5`, `apriori`). Those changes live in `build/` and belong to the environment, not to any phone.

## One tree, four phones

The Y210, C660 and E400 share a Qualcomm platform; the Y220 is MediaTek. They all live in **the same checkout**. Each device tree ships a `patches/` directory with `apply-patches.sh` and `revert-patches.sh` for the changes that touch shared projects (`frameworks/base`, `external/*`). Before working on one phone I revert the other phones' patches.

It works, but it has a real risk: a `revert-patches.sh` that does `reset --hard` on `frameworks/base` can wipe out a commit that never became a patch. It happened with a Y210 one. The rule I took from it: every change in a shared project must exist as a patch **before** anyone reverts.

## The challenges, in order of pain

### 1. ccache that never saved anything

I built "with ccache" and every build took the same time. `ccache -s` showed 39 hits against 2484 misses: `~/.ccache` had ended up owned by root and ccache could not write. The container now mounts `~/.ccache-cm7`, user-owned, with an explicit `CCACHE_DIR`. With a warm cache an incremental build is a different thing.

### 2. Docker Desktop and "stale" files

On Docker Desktop the tree is shared with a VM through a cache. If the container is running and git **replaces** a file (`checkout`, `reset`, `apply -R`), the path can end up pointing to an old inode inside the container: the host sees the new file, the compiler sees the previous one. Anything done before starting the container looks fine. After every git operation I compare `md5sum` on host and container, or restart the container before building. On the E400 I moved to Docker Engine and the problem does not appear.

### 3. An interrupted build leaves garbage with a fresh timestamp

If the machine runs out of memory mid-build, truncated `.apk`, `.jar` or `.so` files remain with a recent date, and the incremental build accepts them. It happened with a `LatinIME.apk` of 8.8 MB instead of 15: the ROM booted with no keyboard. Now, after any interruption, I validate what was written in that window (`zipfile.testzip`, dex header, ELF) and run `unzip -tq` on every apk in the final zip before flashing. And I build with `-j2`: with `-j4`, `systemd-oomd` ended up killing the editor too.

### 4. `build.prop` is not regenerated

In Gingerbread, changing `system.prop` does not invalidate `build.prop`. The symptom was a zip with the old date in its name and a property (`rild.libpath`) still pointing at the blob instead of the shim. I now delete `out/target/product/<dev>/system/build.prop` after touching `system.prop`.

### 5. `breakfast`, `lunch` and the zip name

`breakfast` always ends up as `-eng` even if the script prints `-userdebug`, and `userdebug` fails in FileManager's ProGuard. Also, with `roomservice` active, `breakfast` pointed `device/lge/e400` at CyanogenMod's repo instead of mine. For the E400 I use `lunch cyanogen_e400-userdebug` and `make bacon` with `USER` and `BUILD_NUMBER` set: if `USER` is empty, the zip is called `eng..zip` and the squisher cannot find it.

### 6. `mka bacon` builds everything

It builds **every** `Android.mk`, even if the package is not in `PRODUCT_PACKAGES`. One broken app in `packages/apps` breaks the whole build. Huawei's factory apps (decompiled, they do not compile) ended up behind an `ifeq`.

### 7. Stock blobs are not interchangeable

When something fails it is tempting to copy the stock library. On the E400 I tried the stock `libsurfaceflinger.so`, then `libGLES_android.so` + `libpixelflinger.so`, inside CM7: white screen, then black. Stock framework libraries are built against a *different* framework. Blobs are for HAL and vendor pieces (camera, OMX, RIL), not for the framework.

## Flashing without touching the phone

With TWRP, everything over `adb`: copy the zip to the SD card, write `/cache/recovery/openrecoveryscript` with `install`, `wipe cache` and `wipe dalvik`, then `adb reboot recovery`. About two minutes until `boot_completed`. One detail: do not chain `twrp wipe` right after `twrp install`; it fails with "Another threaded action is already running".

## The device bugs that were not the build

Building is half of it. Some of the ones that took longest:

- **Y210, FM radio with no audio:** `audmgr_enable()` through `/dev/msm_fm` was missing before the audio RPC.
- **E400, stripes when rotating:** SurfaceFlinger's screen capture read `fb0` with 480-byte rows; `msm_fb`'s real stride is 512. Fixed using `line_length` from `FBIOGET_FSCREENINFO`.
- **E400, slow ROM and no radio:** `init.e0.rc` used `on post-fs-data`, which Gingerbread never fires; with `on post-fs` it works.
- **E400, green screen:** the kernel in the tree was not the stock one; with the stock `zImage` it disappears.
- **Y220, charging while off:** a diagnostic `panic()` that slipped into a commit hung the kernel after ~10 s. Lesson: read `last_kmsg` before theorizing.

## What I take away

1. Old container for old code, and leave the host alone.
2. Always check that what the compiler sees is what is on the host.
3. Distrust any artifact written during an interruption.
4. Every change in a shared project goes in as a patch before anything is reverted.

The device trees are at [chijure-android-system-development](https://github.com/chijure-android-system-development). If you build something this old and hit another trap, let me know.
