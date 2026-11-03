---
title: "QApp: testing a ROM without guessing"
date: 2026-11-02
description: "Born to confirm a worn-out battery on the LG D625. Today it's an app that runs an automatic test pass on any Android from 2.2 onward, with a report that survives a phone reset."
tags: [android, qapp]
draft: false
---

Porting a ROM to an old phone comes with a problem that isn't about software: when something fails, it isn't always clear whether the ROM is at fault or the hardware itself, worn down by years of use. **QApp** was born to take that doubt out of the equation.

## The origin: a battery that couldn't keep up

The first version was written for the LG D625, while investigating a reboot that looked like a ROM bug. The battery test measures the idle voltage, puts the CPU and GPU under load for thirty seconds, and measures how far it drops. A healthy battery drops little and recovers fast; a worn one drops a lot and takes a while to come back. That measurement let me rule out the kernel as the cause and confirm the battery was the culprit, without opening the phone or buying a replacement to test.

I used that same test again months later on the [C660]({{< relref "usb-otg-c660.md" >}}), with one difference: the result now gets written to a file while the test runs, not only at the end.

## Why the report has to survive a reboot

The first version of the battery test wrote its result only when it finished. That makes sense as long as the phone doesn't shut down mid-test, but there's the catch: **if the phone reboots during the stress test — exactly the symptom you're trying to confirm — no record is left that the test was interrupted, or at what point.** The most useful log is precisely the one that never gets written.

That's why `RunLog`, the class that logs each step, now:

- Writes one line per voltage sample, synced to disk, not just the final result.
- Marks in system preferences that a test is "in progress" before starting it, and clears that mark only when it finishes cleanly.
- If the app opens and finds that mark set, it means the phone shut down or rebooted mid-test last time, and it notes it as one more line in the report: `INTERRUPTED … uptime now Ns`. A small uptime means the phone really rebooted; a large one means only the app was closed.

This applies the same way to the automatic test pass, the battery stress test, the standby test, the video test and the GPU benchmark: all five write their progress live and recover from a cut, not just from a happy ending.

## What it tests, in order

QApp installs from Android 2.2 (API 8) up to current versions, guarding every API that didn't exist on the oldest phones behind a version check. The automatic pass goes through, unattended:

- **Basics:** sound, vibration, touch, screen and dead pixels, sensors, multitouch, physical and virtual buttons, device info, battery and storage.
- **Connectivity:** Wi-Fi (with a two-minute connection-stability test), Bluetooth, GPS, NFC.
- **Media:** camera and flash, microphone, OpenGL and a GPU benchmark, video playback with bundled H.264 and MPEG-4 clips that check whether the picture keeps up with real time, and recording data of its own.
- **Telephony:** SIM, signal, dialer and SMS shortcuts.

Each result ends up as PASS, FAIL, N/A (when the hardware doesn't exist on that model) or MANUAL (when it needs a person to confirm something, like a sound or a colour). The report can be saved, shared and compared against another ROM's or another build of the same phone, which is the other half of the problem: it isn't enough to know something fails today, you need to know whether it failed before the change you just made.

## A tool that grows with real problems

None of the tests came from a generic "things to test on Android" list. Each one was born from a specific bug: the GPU benchmark, from needing a number to say whether one ROM is smoother than another; the Wi-Fi stability test, from a router that dropped the connection every few minutes; the standby one, from confirming the phone really sleeps with the screen off instead of staying awake and draining the battery for no reason.

It's software, so it doesn't replace a measurement with instruments (a multimeter on the battery, for example), but it replaces something worse: the habit of guessing.

The code is public, at [romtester](https://github.com/chijure/romtester).
