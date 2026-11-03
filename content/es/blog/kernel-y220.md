---
title: "Kernel 3.4.5 para el Huawei Y220-U05: 26 commits de un árbol donante a un Gingerbread estable"
date: 2026-10-23
description: "El Y220-U05 (MediaTek MT6572) corre un kernel sacado de un árbol donante. Esto fue lo que hubo que arreglar, del arranque al Wi-Fi, la cámara, la carga con el teléfono apagado y el hotspot."
tags: [android, kernel, y220, mediatek]
draft: false
---

Este es el segundo de dos artículos sobre el kernel del **Huawei Ascend Y220-U05** (MediaTek **MT6572**, Android 2.3.6 de fábrica). En el [primero]({{< relref "y220-twrp-primero.md" >}}) cuento cómo lo probé en TWRP para no arriesgar el sistema. Aquí van los arreglos.

El punto de partida fue un árbol **donante** de Longcheer para Jelly Bean (`lcsh72_we_jb3`): un Linux 3.4.5 con soporte de MediaTek. Tiene otro panel (DSI FWVGA) y otra memoria (eMMC), y el Y220 tiene un ILI9488 de 320x480 y NAND. Entre el 8 y el 23 de octubre de 2026 hice **26 commits** y compilé kernels numerados hasta el `#98` (el número es el contador de compilaciones). Esto es lo que arreglé.

## Cronología

| Kernel | Qué cambió |
|---|---|
| `#57` | Arranque de la imagen de fábrica hasta el launcher, con teclas, altavoz, cámara y acelerómetro |
| `#76` | Wi-Fi arrancando bien (resultó no ser un fallo del kernel, ver más abajo) |
| `#90` | Tabla de particiones NAND, zram, menos ruido en el log y colores de cámara |
| `#91` | El logo de arranque ya no deja basura en la pantalla |
| `#92` | La vista previa de la cámara no se congela al reabrirla |
| `#93` | Netfilter, para el anclaje USB |
| `#94` | Se quita una interfaz que dejaba reflashear el firmware del táctil |
| `#95` | Se quita un `panic()` de diagnóstico que colgaba la carga apagado |
| `#96` | IPv6 |
| `#98` | Punto de acceso Wi-Fi para el `netd` de Android 4.2 |

## Del donante al teléfono

El primer commit registra el panel ILI9488, maneja el táctil **msg2133** desde el GPIO 110 con el eje Y invertido, y enumera la ranura SD sin la interrupción de detección de tarjeta del donante, para encontrar una tarjeta ya insertada al arrancar.

Para llegar al launcher con la imagen de fábrica hizo falta más: activar **Mali UMP** para que gralloc pueda enganchar buffers, mantener el allocator de stock, y salir de inmediato de las escrituras de `PerfService` que suben la GPU y la CPU, porque sin eso `ActivityManager` no terminaba de arrancar. Luego llegaron las teclas (el volumen como columna de teclado en el GPIO 108), el altavoz, el sensor de cámara **GC0329**, el acelerómetro **KXTJ2** con su mapa de ejes y el almacenamiento masivo USB (`lun0` y `lun1`, y desmontar la tarjeta primaria mientras la segunda FAT está apilada encima).

## Memoria y particiones

Dos errores del donante dieron síntomas lejanos de su causa:

- **La tabla de particiones era la de una eMMC.** `dumchar` apuntaba `/dev/nvram` y los demás nodos a nada, y `ccci_plat` fallaba en `sec_boot_init` al abrir `/dev/`. La tabla ahora es la NAND de fábrica: 18 entradas, con los nombres MTD `seccnfg` y `secstatic`. La interfaz con el módem (CCCI) también pasó a compilarse como módulos (`ccci_plat.ko` y `ccci.ko`), como los carga el `init.rc` de fábrica.
- **Faltaba zram.** El `init.rc` de fábrica crea un swap de 192 MB en `zram0`, y este kernel no podía compilarlo. Activé `ZSMALLOC` y `ZRAM`, y apagué `CONFIG_SLUB_DEBUG_ON`, que venía de la configuración de la plataforma y depuraba todas las cachés.

Además, el kernel escribía unas **22 líneas por segundo** en reposo y `dmesg` rotaba en segundos. Pasé a nivel de depuración las trazas de procesos, wakelocks, batería, teclas, watchdog y sockets, entre otras. En reposo quedó en **1,2 líneas por segundo**, y los errores se conservan.

## Pantalla y cámara

- **Driver propio del panel.** `ili9488_dbi_dijing`, con la secuencia de entrar y salir de reposo de fábrica y sin las comprobaciones de TE que solo existen en DSI, para que la recuperación de ESD no se active en un panel DBI paralelo.
- **Logo de arranque.** El bootloader (LK) dibuja el logo a 16 bits en *su* base de framebuffer, que viene en el ATAG `videolfb` y no coincide con el inicio de la VRAM de 32 bits del kernel. `mtkfb_fb_565_to_8888` convertía desde el inicio de la VRAM, y entre el logo y la animación se veía el último cuadro de la sesión anterior, deformado. Ahora lee el logo desde la base del LK.
- **Colores de la cámara.** El sensor envía `Cb Y Cr Y` y el driver declaraba YUYV, así que las fotos salían verdes y magenta. Lo declaré como UYVY, igual que el `GetInfo` de fábrica, y el overlay YUV422 de `mtkfb` también como UYVY.
- **Vista previa congelada.** Con `MTKFB_NO_M4U`, `mtkfb_get_ovl_mva` guarda en caché una dirección de pantalla por buffer, y nada la limpiaba. Al reabrir la cámara el overlay seguía leyendo las páginas de la sesión anterior y la imagen alternaba entre el último cuadro y negro. Ahora se libera esa dirección al registrar o dar de baja el buffer, tras esperar a que el LCD esté libre.

## El `panic()` que se coló

En el modo de carga con el teléfono apagado, la animación se congelaba y el botón de encendido no llegaba a hacer nada. La causa estaba en mi propio commit de reducción del log (`2d98770d`): se coló una **sonda temporal** en `battery_common.c` que armaba un temporizador y llamaba a `panic()` 4,2 segundos después del primer `BAT_thread`, para volcar la RAM de la consola. El reinicio desde un contexto de temporizador se colgaba en `wdt_arch_reset`. El kernel `#95` la elimina.

La lección fue revisar `last_kmsg` antes de teorizar, y no dejar sondas de depuración dentro de un commit de limpieza.

## Red

- **Netfilter (`#93`).** La configuración del proyecto traía `# CONFIG_NETFILTER is not set`, sin tabla `nat`, así que el anclaje USB no podía hacer NAT. Usé el conjunto de la plataforma MT6572, como el kernel de fábrica. `xt_qtaguid` sigue apagado: Gingerbread no lo usa y necesita IPv6.
- **IPv6 (`#96`).** También venía apagado. Android 4.2 lo necesita: `NetworkInterface` lee `/proc/net/if_inet6` y, sin él, el anclaje de CM10.1 no podía configurar el NAT.
- **WPA2 con `wpa_supplicant` 8.** `mtk_cfg80211_set_default_key()` era un stub que devolvía `-EINVAL`. El `wpa_supplicant` de Android 4.2 manda `SET_KEY default` tras cada clave por pares, y toda asociación WPA/WPA2 fallaba tras el apretón de manos de cuatro vías. Como `add_key` ya marca la clave por pares como de transmisión, bastaba devolver 0.
- **Calibración y WPA2 con Gingerbread.** El *override* de NVRAM del Y220 estaba vacío y reemplazaba la calibración del chip. Además, el `wpa_supplicant` de Gingerbread borra WPA con `SIOCSIWENCODE(DISABLED)` y deja el cifrado de grupo en 0, por lo que las redes CCMP se rechazaban.
- **Punto de acceso (`#98`).** El `netd` de Android 4.2 escribe `AP` o `STA` en `WIFI_DRIVER_FW_PATH_PARAM` y corre hostapd en `wlan0`. El controlador MT6582 solo creaba su dispositivo AP (`ap0`) con una ioctl privada y `/dev/wmtWifi` solo aceptaba `0` y `1`. Ahora `wmt_chrdev_wifi.c` pasa `AP`, `STA` o `P2P` a una función que registra el módulo WLAN: en modo AP renombra el dispositivo de estación a `sta0` y registra el AP como `wlan0`. Para eso `dev_change_name` se exporta al módulo.

## Seguridad

El driver del táctil donante creaba `ms-touchscreen-msg20xx/update` con permisos **0777**, y cualquier aplicación podía reflashear el firmware del táctil. El kernel de fábrica no tiene esa interfaz y la quité (`#94`).

## Lo que parecía kernel y no lo era

El Wi-Fi no arrancaba en Android y `dmesg` apuntaba al controlador. Eran tres problemas de integración: `wlan.ko` era un enlace roto, el HAL de MediaTek no carga su dependencia `cfg80211.ko`, y precargar los dos módulos a mano hacía fallar al HAL con `File exists`. Se arregló con el orden de carga en el ramdisk, no en el kernel.

Una advertencia que costó un susto: **cada módulo de `/system/lib/modules/` debe estar compilado con el kernel que corre**. Un *restore* de TWRP del `/system` de fábrica devuelve los módulos de 2014 y el kernel los carga (mismo `vermagic`, sin `MODVERSIONS`), y entra en pánico dentro de `mtk_stp_wmt`.

## Un cambio que no sirvió

Uno de los commits ignora las liberaciones de la tecla de encendido sin pulsación previa, pero está en `pmic_mt6320.c`, que el Y220 **no compila**: su PMIC es el MT6323. Lo dejé documentado en el propio mensaje del commit. Moraleja: antes de arreglar, comprueba que el archivo que editas llega al binario.

## Compilarlo

```sh
./build.sh y220
```

Con el toolchain `arm-linux-androideabi-4.6`. El código está en el repositorio [android_kernel_huawei_y220-u05](https://github.com/chijure-android-system-development/android_kernel_huawei_y220-u05), y el árbol del dispositivo en [android_device_huawei_y220](https://github.com/chijure-android-system-development/android_device_huawei_y220).

## Lo que sigue

**Actualización (3 de noviembre de 2026).** Acabo de comprar tres teléfonos más de la serie Y de Huawei: un **Y320**, un **Y321** y un **Y330**. Busqué y no encontré fuentes del kernel publicadas para ninguno de los tres (Huawei sí las publica para algunos modelos de gama alta), así que doy por hecho que tampoco las hay y que habrá que repetir el mismo trabajo: capturar el firmware de fábrica, partir de un árbol donante y probar cada kernel primero como recovery, como conté en [el primer artículo]({{< relref "y220-twrp-primero.md" >}}).
