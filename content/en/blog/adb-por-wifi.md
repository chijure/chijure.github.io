---
title: "adb over Wi-Fi, and why it drops right when you need it most"
date: 2026-11-02
description: "adb tcpip is handy for testing a phone's USB host mode, but it depends on Wi-Fi for everything. A mistake I just made shows exactly how the connection gets lost."
tags: [android, adb]
draft: false
---

When I test {{< g "otg" >}} in {{< g "host-mode" >}}, the phone's USB port stops being useful for {{< g "adb" >}}: it's busy talking to the flash drive or mouse plugged into it. The fix is `adb` over Wi-Fi:

```sh
adb tcpip 5555
adb connect <phone-ip>:5555
```

From there I can unplug the cable and keep watching the phone's `dmesg` while testing host mode. It works well, with one condition that's easy to forget: **everything goes through Wi-Fi**, so anything that affects Wi-Fi affects the debugging session.

## The mistake I just made

While preparing this very piece, I left the C660 in `tcpip` mode and, in the same batch of commands, turned off its Wi-Fi to test something else:

```sh
$ adb tcpip 5555
restarting in TCP mode port: 5555
$ adb connect 192.168.1.11:5555
connected to 192.168.1.11:5555
$ adb shell 'svc wifi disable'
$ adb connect 192.168.1.11:5555
failed to connect to '192.168.1.11:5555': No route to host
```

At that point the phone had no way to receive adb commands: the TCP port doesn't work without Wi-Fi, and the phone was still in `tcpip` mode, so it didn't answer over USB either. The only way out was plugging the cable back in: `adb usb` followed by physically reconnecting the cable restores normal mode, because the system itself detects the cable and restarts `adbd`.

## What to remember

- **`adb tcpip` switches the `adbd` daemon's mode, it doesn't open a second channel.** While it's in TCP mode, USB mode stops answering, cable plugged in or not.
- **The property that enables the port doesn't survive a phone reboot.** Every time the phone reboots (during a kernel test, for example), you have to run `adb tcpip 5555` again from a USB session.
- **Never turn off Wi-Fi while you depend on TCP mode to regain control.** If you need to, plug the USB cable in beforehand and switch to `adb usb` right before.
- **`adbd`'s automatic restart** also happens if you use `stop adbd; start adbd` via `shell` instead of `adb usb`: it sometimes takes a few seconds to come back, so it's worth waiting and retrying the connection instead of assuming it failed.

The real lesson isn't to avoid `adb` over Wi-Fi, which is still the only practical way to debug a phone whose USB port is busy in host mode. It's treating it for what it is: a session that depends on an extra layer (Wi-Fi), and one that can be lost over something that has nothing to do with `adb` itself.
