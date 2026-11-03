---
title: "USB OTG en el LG C660: qué medí y por qué no funciona"
date: 2026-11-02
description: "Activé la pila USB host del kernel 2.6.35, forcé el modo host y medí el PHY. Con un pendrive y con un mouse, las líneas D+ y D- nunca se mueven."
tags: [android, kernel, usb]
draft: false
---

En el LG L3 (E400) el modo USB host funcionó con un adaptador {{< g "otg" "OTG" >}} alimentado, así que intenté lo mismo en el **LG Optimus Pro C660**. No funciona, y esto es lo que medí para saberlo con certeza.

## El punto de partida

El {{< g "kernel" "kernel" >}} 2.6.35 del C660 estaba compilado sin la pila host: faltaban `CONFIG_USB`, `USB_EHCI_HCD`, `USB_EHCI_MSM` y `USB_STORAGE`. La placa sí registraba el controlador `msm_hsusb_host`.

Al activarlos, `usb-storage` no compilaba: el kernel de LG tenía los prototipos de `usb_usual_ignore_device` dentro de un `#ifdef CONFIG_USB_LIBUSUAL`, aunque `usb-storage` los usa sin libusual. Bastó sacarlos del `#ifdef`.

## Lo que sí quedó funcionando

- El driver lee el **{{< g "id-pin" "pin ID" >}}** (`otg_mode` en `OTG_ID`), así que ignoraba el {{< g "host-mode" "modo host" >}} pedido por `debugfs`. Añadí un indicador `user_host` que solo actúa cuando se pide `host`.
- Con `echo host > /sys/kernel/debug/otg/mode` el bus `usb1` se registra y la máquina de estados llega a `a_wait_bcon`.
- El {{< g "phy" "PHY" >}} informa **ID a tierra** y **{{< g "vbus" "VBUS" >}} válido**.

## Lo que no funciona

Con el pendrive (full-speed, {{< g "pull" "pull-up" >}} en D+) y con un mouse (low-speed, pull-up en D-), el estado de línea del PHY queda en **{{< g "se0" "SE0" >}}** y el puerto nunca marca conexión. Probé seis valores del registro *Function Control* del PHY, con y sin los pull-downs de D+ y D-: ninguna línea se mueve.

Algo engañoso: al quitar los pull-downs aparecían errores `-71`, pero eran una **falsa conexión**. Con la terminación de modo dispositivo, el propio PHY sube D+ y el controlador cree que hay un dispositivo.

## Conclusión

El adaptador y el pendrive funcionan en el L3, y VBUS llega al PHY. Lo más probable es que los datos del micro-USB no lleguen al PHY con un cable OTG, quizá por un conmutador que controla el módem. No se resuelve desde el kernel y no tengo el esquema de la placa, así que dejo el experimento documentado en una rama y no sigo.

## Cómo retomarlo

```sh
mount -t debugfs none /sys/kernel/debug
echo host > /sys/kernel/debug/otg/mode
echo dump > /sys/kernel/debug/otg/mode   # lee los registros del PHY
echo "ulpi 0x04 0x40" > /sys/kernel/debug/otg/mode
```

Con el modo host activo el puerto USB no sirve para {{< g "adb" "adb" >}}: hay que usar adb por Wi-Fi.
