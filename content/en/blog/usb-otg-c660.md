---
title: "USB OTG on the LG C660: what I measured and why it does not work"
date: 2026-11-02
description: "I enabled the USB host stack in the 2.6.35 kernel, forced host mode and measured the PHY. With a flash drive and with a mouse, the D+ and D- lines never move."
tags: [android, kernel, usb]
draft: false
---

On the LG L3 (E400), USB host mode worked with a powered OTG adapter, so I tried the same on the **LG Optimus Pro C660**. It does not work, and this is what I measured to be sure.

## Starting point

The C660's 2.6.35 kernel was built without the host stack: `CONFIG_USB`, `USB_EHCI_HCD`, `USB_EHCI_MSM` and `USB_STORAGE` were missing. The board did register the `msm_hsusb_host` controller.

Once enabled, `usb-storage` failed to build: LG's tree had the `usb_usual_ignore_device` prototypes inside an `#ifdef CONFIG_USB_LIBUSUAL`, even though `usb-storage` uses them without libusual. Moving them out of the `#ifdef` was enough.

## What did work

- The driver reads the **ID pin** (`otg_mode` is `OTG_ID`), so it ignored the host mode requested through `debugfs`. I added a `user_host` flag that only takes effect when `host` is requested.
- With `echo host > /sys/kernel/debug/otg/mode` the `usb1` bus registers and the state machine reaches `a_wait_bcon`.
- The PHY reports **ID grounded** and **VBUS valid**.

## What does not work

With a flash drive (full-speed, pull-up on D+) and with a mouse (low-speed, pull-up on D-), the PHY line state stays at **SE0** and the port never reports a connection. I tried six values of the PHY *Function Control* register, with and without the D+ and D- pull-downs: neither line moves.

Something misleading: removing the pull-downs produced `-71` errors, but that was a **false connection**. With the device-mode termination, the PHY itself pulls D+ high and the controller believes a device is attached.

## Conclusion

The adapter and the flash drive work on the L3, and VBUS reaches the PHY. Most likely the micro-USB data lines do not reach the PHY with an OTG cable, perhaps through a switch driven by the modem. It cannot be fixed from the kernel and I do not have the board schematic, so I documented the experiment on a branch and stopped.

## How to pick it up again

```sh
mount -t debugfs none /sys/kernel/debug
echo host > /sys/kernel/debug/otg/mode
echo dump > /sys/kernel/debug/otg/mode   # read the PHY registers
echo "ulpi 0x04 0x40" > /sys/kernel/debug/otg/mode
```

With host mode on, the USB port is no good for adb: use adb over Wi-Fi.
