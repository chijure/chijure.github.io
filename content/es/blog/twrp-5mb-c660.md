---
title: "TWRP en una partición de 5 MB: el LG C660"
date: 2026-11-02
description: "La partición de recovery del C660 mide 5 MB. Así quedó TWRP 3.1.1 en 4,35 MB, con adb, sideload y almacenamiento USB."
tags: [android, twrp, kernel]
draft: false
---

La partición `recovery` del **LG Optimus Pro C660** es una {{< g "mtd" "MTD" >}} de solo `0x500000` bytes (5 MB). Con el {{< g "kernel" "kernel" >}} de la {{< g "recovery" "recovery" >}} original (3,2 MB) {{< g "twrp" "TWRP" >}} no cabe, así que hubo que adelgazar el kernel.

## El resultado

La imagen final pesa **4.349.952 bytes**, con unos 0,9 MB libres. Funciona la pantalla táctil, {{< g "adb" "adb" >}}, `adb sideload`, el almacenamiento USB de la microSD, y grabar la imagen con `flash_image` y leerla de vuelta idéntica. Quedan fuera {{< g "mtp" "MTP" >}} y el almacenamiento interno, porque el teléfono no tiene.

## Lo que costó descubrir

| Síntoma | Causa | Arreglo |
|---|---|---|
| adb no aparece | El `adbd` de KitKat espera {{< g "functionfs" "FunctionFS" >}} y este kernel usa el `/dev/android_adb` antiguo | Incluir el `adbd` de {{< g "gingerbread" "Gingerbread" >}} |
| adb sigue sin aparecer | El `adbd` de Gingerbread sale si no puede abrir su escucha TCP | `CONFIG_INET=y` en el kernel |
| "Reiniciar al sistema" vuelve a recovery | El {{< g "bootloader" "bootloader" >}} de LG deja una marca en `misc` y TWRP no puede escribir el {{< g "bcb" "BCB" >}} en MTD | Un servicio de `init` que borra `misc` al arrancar |
| La pantalla queda con una imagen vieja | El LCD solo se refresca con `FBIOPAN_DISPLAY` | `TW_FBIOPAN := true` |
| `adb sideload` falla | TWRP sirve el zip por {{< g "fuse" "FUSE" >}} y el kernel lo traía apagado | `CONFIG_FUSE_FS=y` (+25 KB) |

## Un detalle de Android 4.4

El sistema de compilación de KitKat no detecta cambios en `LOCAL_CFLAGS`. Si cambias una bandera y la imagen sale idéntica, borra los intermedios de `libminuitwrp` y de `recovery` y comprueba que el md5 cambie.
