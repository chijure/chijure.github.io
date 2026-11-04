---
title: "Platform patches or device tree: why I choose HALs and shims"
date: 2026-10-22
description: "My rule in ports: don't patch Android's platform code; solve hardware differences in the device tree with HALs and shims. Three real examples."
tags: [android, device-tree]
draft: false
slug: hals-and-shims
aliases: [/blog/hals-y-shims/]
---

If you look at the device trees I have published, you will find the same sentence repeated: *"all through a {{< g "device-tree" >}} HAL, like on the Y220"*. It is not an abstract rule, it is a decision I make on every port, and one I have paid to undo when I did not follow it. This is what it means and why I prefer it.

## The problem with patching the platform

A {{< g "cm" >}} tree shares `frameworks/base`, `system/core` and the rest of the platform across **every** phone built from the same tree. If I fix something on the Y210 by editing `frameworks/base` directly, that change also travels to the Y220 and C660 builds, even when they don't need it or, worse, when it breaks something for them.

It has happened to me: a camera patch for one phone ended up accidentally tangled with another phone's Bluetooth patch, and a clean build failed because `apply-patches.sh` tried to apply a fragment that did not belong to it. The rule I ended up writing is simple: **platform changes, when unavoidable, live as `.patch` files inside the device tree** (`device/<vendor>/<model>/patches/`), with a script that applies them and another that reverts them, never as a loose commit in the platform repository.

But the real goal is needing as few of those patches as possible, and that is what {{< g "hal" >}}s and shims are for.

## Example 1: an `LD_PRELOAD` instead of touching bionic

The Y220 (MediaTek MT6572) uses stock video blobs that expect symbols {{< g "cm" >}}'s bionic does not have: a couple of CPU-affinity syscalls, a pthread thread-id getter, and a shared-memory class (`MemoryHeapBaseMTK`) that in the stock binary is just a wrapper around the standard Android class.

The solution I ruled out was patching the tree's bionic, since that affects every phone. Instead I wrote a small library, `libmtk_shim`, that defines those symbols, and preload it only in the process that needs them:

```
setenv LD_PRELOAD libmtk_shim.so
```

in the `media` service of `init.rc`. Gingerbread's linker looks in preloaded libraries first, so the video blobs find the symbols without bionic or any other system process ever knowing. It is the same mechanism you'd use to hook a library's functions on Linux, applied to closing a binary-compatibility gap.

## Example 2: bridges for a Bluetooth stack that is not BlueZ

The Y220's kernel has no Bluetooth sockets (`AF_BLUETOOTH` is off): the stock stack is MediaTek's `mtkbt`, which talks to the phone over its own datagram sockets, not BlueZ. All of CM7's Bluetooth code assumes BlueZ.

The easy alternative would have been porting all of BlueZ, enabling the socket in the kernel, and using CM7's code as is. I ruled it out for two reasons: BlueZ means bringing up and testing a whole new stack, and the stock stack is already tested by the vendor against that exact hardware. Instead I wrote **small bridges**, one per function: one translates Android's API calls (power on, scan, pair) into `mtkbt` messages; another does the same for sending and receiving files over OPP; another for A2DP. Each bridge is a library of a handful of functions, with a minimal patch to `frameworks/base` only where Android's API leaves no other way in.

The result works the same for whoever uses the phone, but the platform-patch surface is minimal and documented file by file.

## Example 3: loading a RIL class by name, not by a parallel branch

Several of my trees share the same platform `PhoneFactory.java`, and each phone needs a different RIL implementation (the interface to the modem). The temptation is to fork `PhoneFactory` per phone, but that mixes platform and device again.

The actual patch is minimal:

```java
} else if ("mediatek".equals(sRILClassname)) {
    // MediaTekRIL comes from the device tree, so load it by name;
    // trees without it still build.
    Log.i(LOG_TAG, "Using MediaTek RIL");
    sCommandsInterface = new MediaTekRIL(context, networkMode, cdmaSubscription);
```

The `MediaTekRIL` class itself lives in the device tree, not the platform. The patch to `PhoneFactory` is the only line that touches the shared tree, and it is harmless for any other phone: if its device tree doesn't define `sRILClassname=mediatek`, that branch of the `if` never runs.

## The experiment that confirmed the rule

It doesn't always work on the first try. On the [C660]({{< relref "usb-otg-c660.md" >}}) I tried a RIL shim to fix a misreported SIM state, intercepting calls between the stock blob and the platform. I failed: the shim broke the radio state machine ("`Unrecognized RIL_RadioState: 3`"), and I dropped it. The final fix was, again, a one-line patch to the platform class that already existed (`QualcommNoSimReadyRIL`), justified and documented like the others.

The shim was not the wrong tool in general: it was the wrong tool for that specific problem, because the bug was in how the platform interprets a state, not in a missing symbol or API to replace.

## The rule, in short

1. If the problem is a missing symbol or function at runtime, an `LD_PRELOAD` or a small shared library, scoped to the process that needs it.
2. If the problem is that the hardware speaks a different protocol than the platform expects, a translation bridge, function by function, not a full port of the alternative stack.
3. If touching the platform is truly unavoidable, make it as few lines as possible, loaded by name or by a device-tree condition, and keep it as a versioned patch in the device tree.
4. Before writing the bridge, confirm the problem is really binary or protocol compatibility, not platform logic. A shim does not fix wrong logic.
