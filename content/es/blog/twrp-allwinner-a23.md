---
title: "Un TWRP para una tablet Allwinner A23 sin firmware original"
date: 2026-11-08
description: "La Advance SP6446 perdió su firmware original. Respaldé la NAND sin escribirle nada, compilé un TWRP con su propio kernel y lo grabé con verificación."
tags: [android, allwinner, twrp, a23]
draft: false
---

La **Advance SP6446** es una tablet de 7 pulgadas con un Allwinner **A23** (familia `sun8i`), 1 GB de RAM y una pantalla de 800×480. Su dueño, que soy yo, había perdido el firmware original y le grabó en su día el de una **Inet T-708+**. Por eso el sistema se presenta como Inet aunque el hardware sea el de la SP6446. No encontré el firmware original en ninguna parte, así que el objetivo cambió: **hacer un TWRP propio y tener un respaldo fiable** de lo que hoy funciona.

Lo de que sea un A23 es una deducción: el nombre de compilación contiene `A23_86DZ`, y existe una placa `INet-86DZ` de tipo `allwinner,sun8i-a23` en el device tree de Linux. No lo confirmé abriendo la tablet.

## Primero la radiografía

Pasé [xray]({{< relref "xray-radiografia-android.md" >}}) con root. Datos que importan:

- Android 4.2.2, {{< g "kernel" "kernel" >}} 3.4.39, `ro.secure=0`: adb entra como root.
- **1 GB de RAM física**, pero `MemTotal` marca unos 906 MB. `/proc/iomem` declara el bloque `40000000-7fffffff` de System RAM, es decir, exactamente 1024 MB. La diferencia son unos 118 MB que el kernel reserva (pantalla, vídeo y GPU, según deduzco; el `dmesg` no guardó el desglose).
- Particiones con nombre en la {{< g "nand" "NAND" >}}: `boot-resource`, `env`, `boot`, `system`, `data`, `misc`, `recovery`, `cache`, `databk`, `private` y `UDISK`, de `nanda` a `nandk`.

## El respaldo: solo lectura, y no todo

Mi regla fue **no escribir nada en la tablet**, ni un archivo temporal: `/sdcard` está en la misma NAND. Cada partición pasa por USB directamente al PC.

El adb de un Android 4.2 no soporta `exec-out`, y el `busybox` de la tablet no trae `nc`. Lo que sí funcionó fue `adb pull /dev/block/nandb`: con una partición de 16 MB el tamaño fue exacto y el md5 coincidió con el que calculó la propia tablet. Con eso confirmé el método y lancé el resto.

Mi primer plan eran 7 GB. Lo corregí al ver las cifras: **4,6 GB eran solo `UDISK`**, el almacenamiento de usuario, que no es firmware. Quité también `cache` y `data`. Quedaron **8 particiones y 957 MB**, todas con el hash verificado contra el de la tablet. Dos tropiezos míos: mi script llamaba a `md5sum`, que la tablet no trae (usa `md5`), y por eso marcó "DIFERENTE" sobre datos que estaban bien; y un `pkill` mal escrito mató mi propia orden.

## Qué trae el recovery de fábrica

Abrí el `recovery.img` de fábrica. Es formato Android estándar, con el **mismo kernel de 7,6 MB que el `boot.img`**, y su ramdisk carga diez módulos `.ko` en un orden concreto: `nand`, los controladores táctiles y después `disp` y `lcd`. El árbol de TWRP necesita ese mismo orden. No hay fuentes de este kernel, así que lo usé tal cual como prebuilt, junto con sus módulos.

## El TWRP

Creé `device/allwinner/a23` en un árbol de TWRP 3.1.1 con base omni 4.4. Los datos salen de la tablet: base de arranque `0x40000000`, páginas de 2048, la cmdline de fábrica y las particiones por nodo directo (`/dev/block/nandX`).

Para compilar uso un contenedor Ubuntu 12.04 en Docker Desktop. Corre sobre CPU x86 real, sin emulación, aunque dentro de la máquina virtual ligera que usa Docker Desktop.

La pantalla fue el punto de duda. El framebuffer es **800×480 horizontal, 32 bits** y con doble buffer. En lugar de adivinar el formato de píxel, grabé el recovery, copié `/dev/graphics/fb0` y lo convertí a PNG. Colores correctos con `BGRA_8888`. El táctil es un **GSL1688E**: el kernel prueba `ft5x` y `ft5402` (fallan por I2C, es lo esperado) y detecta el `gslX680new` en la dirección `0x40`. El `recovery.log` y el `dmesg` solo muestran avisos de la placa que el firmware de fábrica también tiene.

## Grabar sin sorpresas

El procedimiento fue: subir la imagen a `/dev` (que es RAM), comprobar su hash allí, `dd` solo a `nandg` y volver a leer la partición para comparar. No probé `adb push` directo sobre el nodo de bloque, por precaución. Un detalle: el `md5` de la tablet no lee de una tubería, así que la verificación definitiva la hice con `busybox md5sum`.

## Brillo

TWRP necesitaba una ruta de brillo y no tenía ninguna. El Android de fábrica no usa sysfs: su módulo de luces solo menciona `/dev/disp` en sus cadenas, así que supongo que lo hace por `ioctl`. Pero el driver `disp` expone `/sys/class/disp/disp/attr/lcd_bl`, que valía 197. Escribí 60, esperé unos segundos y volví a 197: la pantalla se oscureció. Eso lo configuré como `TW_BRIGHTNESS_PATH`, con máximo 255 y 197 por defecto, y grabé la imagen nueva con el mismo procedimiento.

Con el recovery nuevo, el `recovery.log` dice `Found brightness file at '/sys/class/disp/disp/attr/lcd_bl'` y `Setting brightness control to 197`, y el deslizador de *Settings* cambia el brillo de la pantalla. Ya no sale el aviso `Unable to locate brightness file`.

## El error que me costó la batería

La tablet estaba al 5–9 % cuando grabé, y mi script imprimió `0 Charging` y siguió. Luego reinicié en recovery y se descargó del todo. La grabación estaba verificada antes del reinicio y la tablet volvió a arrancar bien, pero fue un descuido. En TWRP el `capacity` de sysfs marca 0 y no sirve: hay que mirar `voltage_now` (3,5 V es un 5–10 %) o la batería desde Android. Ahora el script debe **abortar** si el nivel es bajo, antes de `dd` y antes del reinicio.

## Estado y lo que falta

- Funciona: arranque del recovery, adb, pantalla y colores, táctil, **control de brillo**, montaje de `/system`, `/data`, `/cache` y la memoria interna.
- Sin probar: la microSD y las copias de seguridad de `data` y `system`.
- No recuperé el firmware original de la SP6446. Lo que sí hay es el respaldo verificado de lo que corre hoy.
