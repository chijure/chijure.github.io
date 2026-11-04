---
title: "Persistent TWRP on the LG Optimus F3 P659H: a new Loki target"
date: 2026-11-04
description: "The P659H rejected TWRP with “boot certification verify”. I analyzed its aboot, added a Loki target, and obtained persistent recovery."
slug: loki-lg-f3-p659h
tags: [android, bootloader, lg, twrp, loki]
draft: false
---

The **LG Optimus F3 P659H** (`fx3sca`, firmware `P659h10a`) could boot a custom recovery temporarily, but would not accept one in its recovery partition. After writing TWRP directly and running `adb reboot recovery`, the result was always **“boot certification verify”**. LG's {{< g "bootloader" "bootloader" >}} rejected the installed image before executing its {{< g "kernel" "kernel" >}}.

The solution was not a permanent `aboot` modification. I added this model to **Loki**, the classic technique that exploits how some older LG bootloaders load and verify `boot` and `recovery`. The result is **persistent TWRP 3.1.1-0**: `adb reboot recovery` now enters TWRP directly, while Android still boots from its original `boot` partition.

## Fastboot had to be found first

The published `fx3` kernel source confirmed that `reboot("bootloader")` writes reboot reason `0x77665500` to Qualcomm shared memory. The phone received it—the next boot showed `lge.r=77665500_20`—but still did not expose {{< g "fastboot" "Fastboot" >}}. Static analysis of `aboot` explained why: LG had removed the normal Fastboot mode selection and left Fastboot initialization only as an error fallback when an Android image could not be loaded.

For a controlled test, I temporarily changed the first byte of the `boot` magic from `ANDROID!` to `XNDROID!`. Unable to recognize the image, `aboot` fell back to Fastboot (`18d1:d00d`, product `FX3_SCA`). From there I could test TWRP with `fastboot boot` and immediately restore the original `boot.img`. This proved that TWRP's kernel and {{< g "ramdisk" "ramdisk" >}} were compatible with the phone; only LG's certification path prevented a persistent installation.

## Why writing TWRP was not enough

The raw TWRP image was written to `recovery` and read back in full. Its hash matched, ruling out a bad write or the wrong partition. `aboot` still displayed “boot certification verify”. Fastboot's standard `Device unlocked: true` state did not disable LG's proprietary check for an installed image either.

Loki builds a specially arranged image. It retains the real kernel and ramdisk, but makes `aboot` load an apparent one-page ramdisk over the beginning of its own verification function in RAM. The small payload placed there then repairs the active header so the kernel receives the real addresses and sizes. The change exists only for that boot; the `aboot` partition remains untouched.

The original `loki_tool` found its code pattern but stopped with `Unsupported aboot image`: it had no P659H target. Two addresses had to be recovered from this specific binary:

```c
{
    .vendor = "Movistar/Latin America",
    .device = "LG Optimus F3 P659H",
    .build = "P659h10a",
    .check_sigs = 0x88f102e8,
    .hdr = 0x88f64aa8,
    .lg = 1,
},
```

`check_sigs` is the cryptographic routine called by the secure-boot path. Its pattern is at file offset `0x10310`; after accounting for the `aboot` load header, its runtime address is `0x88f102e8`.

`hdr` was the difficult part. It is neither an arbitrary Android-header copy nor the fixed address used for an initial read. It is the **active header** consumed by the common path immediately before verification and boot. In the P659H disassembly, `aboot` explicitly loads `r4 = 0x88f64aa8` and reads:

```text
r4 + 0x08  kernel size
r4 + 0x0c  kernel address
r4 + 0x10  ramdisk size
r4 + 0x14  ramdisk address
```

Those are exactly the fields rewritten by the Loki payload.

## Failures that revealed the correct address

Two plausible-looking addresses produced an image that got past certification, but not a working recovery. The phone ran TWRP's kernel and returned to Android five seconds later. `/proc/last_kmsg` preserved the reason:

```text
INITRD: 0x88f102e0+0x00000800 is not a memory region - disabling initrd
VFS: Cannot open root device "(null)" or unknown-block(0,0)
Kernel panic - not syncing: VFS: Unable to mount root fs
```

`0x88f102e0` was Loki's decoy ramdisk, and `0x800` was one page. The kernel ran, but the payload had not repaired the header actually consumed by the final boot path. This log ruled out the kernel, TWRP packaging, and partition layout, and forced the analysis to follow `r4` through the complete `boot_linux_from_mmc` path.

With `hdr = 0x88f64aa8`, Loki restored the real values:

```text
kernel  -> 0x80208000
ramdisk -> 0x82200000
```

TWRP appeared on screen, and {{< g "adb" "ADB" >}} independently confirmed the environment:

```text
/sbin/recovery
/sbin/twrp
ro.twrp.version=3.1.1-0
ro.build.product=fx3
```

The installed image, `twrp_recovery_fx3_v4.lok`, is 9,261,056 bytes in a 12,582,912-byte partition. It was read back from `mmcblk0p18` and compared byte for byte before reboot. Its SHA-256 is:

```text
c1ce4810d7ee78f64bda486b73fe42708e6a57e2dccb1879823d6fed9ac662dd
```

## What changed—and what did not

The phone now has a Loki-modified TWRP {{< g "recovery" "recovery" >}}. It does not have a rewritten `aboot`: the redirection happens in RAM whenever recovery is loaded. A stock LG recovery backup was preserved and fully hashed before testing.

This provides a safe base for backups, restoration, and development, but it does not make a ROM for another Optimus F3 variant compatible. A ROM still needs a proper `fx3sca` port, the correct proprietary blobs, and a `boot.img` that can also pass LG's verification—for example, one patched with the P659H Loki target. TWRP was the door; porting CyanogenMod is the next job.

The kernel source used as a reference is available at [playfulgod/kernel_lge_fx3](https://github.com/playfulgod/kernel_lge_fx3). The earlier case that helped separate this Qualcomm problem from the Tegra workflow is covered in [unlocking the LG D625 with nvflash]({{< relref "nvflash-lg-d625.md" >}}).
