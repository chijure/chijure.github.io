---
title: "USB OTG en el LG L3 (E400): modo host con un interruptor de software"
date: 2026-11-01
description: "El kernel stock del L3 ya traía host USB. Faltaba montar el disco y un interruptor para forzar el modo host: el pin ID no llega al procesador."
tags: [android, usb, e400]
draft: false
---

En el **LG Optimus L3 (E400)** con {{< g "cm" "CyanogenMod" >}} 7, un pendrive conectado por {{< g "otg" "USB OTG" >}} funciona: se monta solo y se lee desde el teléfono. Esto es lo que hizo falta, y lo contrasto con el [C660]({{< relref "usb-otg-c660.md" >}}), donde no hubo manera.


## Lo que ya traía el teléfono

El {{< g "kernel" "kernel" >}} 2.6.38 de LG ya incluye el controlador host (`msm_hsusb_host.0`), `usb-storage` y un control en `debugfs`. No hizo falta tocar el kernel. Lo que faltaba:

1. **Montar el disco.** Una entrada `usbdisk` en `vold.fstab` que apunta a `/devices/platform/msm_hsusb_host.0` y monta el pendrive en `/mnt/usbdisk`.
2. **Un interruptor.** El {{< g "id-pin" "pin ID" >}} del micro-USB **no llega al procesador** (el registro `OTGSC` lo da siempre en 1), así que el teléfono nunca se pone en {{< g "host-mode" "modo host" >}} solo. Hay que forzarlo.

## El interruptor

El kernel acepta el modo en `/sys/kernel/debug/otg/mode`. Lo conecté a una propiedad del sistema (`sys.otg.mode`) mediante `init.e0.rc`, y escribí una pequeña app, **OtgSwitch**, con un botón que la cambia entre `host` y `peripheral`. Se ejecuta con el usuario del sistema porque solo él puede escribir esa propiedad.


## Cómo se usa

1. Abre OtgSwitch y activa el modo host **antes** de enchufar el cable.
2. Conecta el adaptador OTG y el pendrive.
3. El disco aparece en `/mnt/usbdisk`.
4. Para volver, desactiva el modo host: recuperas {{< g "adb" "adb" >}} y la carga por USB.

## Qué adaptador usé

Un adaptador **micro-USB OTG en ángulo de 90°** ([ficha en Mercado Libre](https://www.mercadolibre.com.pe/adaptador-micro-usb-otg-90-grados-derecho/up/MPEU2463941096)).


## Límites

- **El teléfono no entrega 5 V.** Hace falta alimentación externa para el dispositivo conectado.
- El modo host desactiva la detección de {{< g "vbus" "VBUS" >}} y de ID, y **se pierde al reiniciar**.
- Con el host activo el puerto USB no sirve para adb: usa adb por Wi-Fi (`setprop service.adb.tcp.port 5555`).
- Un ratón y un teclado aparecen como dispositivos de entrada normales. El ratón lo probé en una compilación de CM10.1.

El código está en el [árbol del dispositivo](https://github.com/chijure-android-system-development/android_device_lge_e400) y la app en [OtgSwitch](https://github.com/chijure-android-system-development/android_packages_apps_OtgSwitch).
