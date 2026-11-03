---
title: "What doesn't exist in the Android 2.3 shell (and what does, against what I believed)"
date: 2026-11-02
description: "input tap, swipe and am force-stop don't exist on Gingerbread. The shell's $((...)) arithmetic, on the other hand, does work: I checked it on a real phone after assuming the opposite."
tags: [android, gingerbread]
draft: false
---

Debugging a {{< g "gingerbread" >}} (Android 2.3) phone over `adb shell` has traps that don't exist on newer versions, and it's worth knowing them before writing a script that hangs halfway through a test.

## What really doesn't exist

Confirmed on an LG C660 running CM7:

```
$ input tap 10 10
Error: Unknown command: tap

$ input swipe 10 10 20 20
Error: Unknown command: swipe

$ am force-stop com.example
Error: Unknown command: force-stop
```

`input` on this version only accepts `text` and `keyevent`; to simulate a touch you have to use `sendevent` directly on the input device, or a `keyevent` if the element already has focus. To force-close an app without `force-stop`, the alternative is killing the process by `pid` (`ps` + `kill`), or `am kill`, which is gentler and doesn't always free the memory.

## A correction to something I myself assumed

For quite a while I assumed shell arithmetic (`$((i+1))`) also didn't work on Gingerbread, because in an earlier session a loop using that syntax hung. I tested it again today, directly on a real C660, before publishing this:

```sh
$ i=0; while [ $i -lt 3 ]; do i=$((i+1)); echo i=$i; done
i=1
i=2
i=3
```

It works fine. That earlier hung loop wasn't caused by the arithmetic: it was caused by the loop pattern as a whole (probably a condition that never went false, or a command waiting on input). The honest thing to say is that **I don't know** exactly what hung it, not that `$((...))` is broken. It's its own lesson: before generalising a cause, it's worth isolating the suspect piece and testing it alone, as I just did.

## `cp` and `grep` exist, but not where you'd expect

`toolbox`, Android's minimal set of utilities, ships no `cp` or `grep` on Gingerbread. If your ROM has them, it's because BusyBox provides them:

```sh
$ ls -l /system/bin/cp
ls: /system/bin/cp: No such file or directory
$ which cp
/system/xbin/cp
$ ls -l /system/xbin/cp
... -> busybox
```

The distinction matters when you're writing a script meant to work on any Gingerbread build, including ones without BusyBox: in that case `cp` and `grep` simply aren't there, and you have to use `cat` and `toolbox` combinations instead.

## `sleep` also depends on who answers

On a phone with BusyBox, the command that answers `sleep` can be `toolbox`'s or BusyBox's, depending on `PATH` order, and **they are not equivalent**: `toolbox`'s `sleep` ignores the fractional part.

```sh
# toolbox sleep (six calls to "sleep 0.5")
real    0m1.0s

# busybox sleep (the same six calls)
real    0m3.0s
```

If a script that times things with short stock pauses gives numbers that don't add up, it's worth checking which `sleep` is answering first (`which sleep`, or forcing `busybox sleep` directly) before suspecting the script's logic.
