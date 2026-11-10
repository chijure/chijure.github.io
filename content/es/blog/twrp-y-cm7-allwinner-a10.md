---
title: "Un TWRP y un CM7 para una tablet Allwinner A10, con GPU y sensores"
date: 2026-11-10
description: "BRONCHO PAD703 (Allwinner A10): TWRP con el kernel de fábrica y un CyanogenMod 7 que arranca con Mali y acelerómetro. Qué falló, cómo se midió y qué falta."
tags: [android, allwinner, a10, twrp, cm7, gingerbread]
draft: false
---

La **BRONCHO PAD703** es una tablet de 7 pulgadas con un Allwinner **A10** (familia `sun4i`, Cortex-A8, GPU Mali-400), pantalla de 800×480 y un Android 4.0.3 de fábrica. El `MemTotal` marca unos 306 MB aunque la placa tiene 512. Entra con adb como root, y eso lo cambió todo: pude **medir** casi cada cosa en lugar de suponerla. Este artículo cuenta el camino hasta un TWRP y un CyanogenMod 7 ({{< g "gingerbread" "Gingerbread" >}}) que arrancan en ella, con lo que funciona y lo que no.

## Mapa de la NAND y respaldo primero

La {{< g "nand" "NAND" >}} se parte en `nanda` a `nandj`: `nanda` es una FAT de 16 MB con `script.bin` y U-Boot, `nandb` el entorno de U-Boot, `nandc` el `boot`, `nandd` el `system` (256 MB), `nande` el `data`, `nandf` el `misc`, `nandg` el `recovery`, `nandh` la caché, `nandi` un `/oem` y `nandj` el almacenamiento de usuario. Antes de grabar nada copié `nanda`, `nandb`, `nandc`, `nandf` y `nandg` al PC, con `sha256` de cada una.

Una trampa de método: el adb de Android 4.0 no soporta `exec-out`, así que cada partición se copia primero al almacenamiento de usuario (`nandj`, no a las particiones del sistema) y se baja con `adb pull`.

## El TWRP: un kernel que ya servía

El `boot` y el `recovery` de fábrica llevan **el mismo** `zImage` (Linux 3.0.8). Lo reutilicé tal cual y con `--base 0x40000000` el `mkbootimg` normal reproduce la cabecera original, sin herramientas especiales. Lo demás fueron detalles medidos:

- **Táctil.** El `ft5x_ts` es un módulo `.ko` que Android carga desde `/system`. Un recovery no tiene `/system`, así que va dentro del ramdisk.
- **Color.** `fb0` es de 800×480, 32 bpp, y `BGRA_8888` acertó a la primera.
- **Brillo.** No hay `/sys/class/backlight`. Desensamblé `lights.sun4i.so` de Android y vi que hace un `ioctl` `0x142` al nodo `/dev/disp` con `{0, brillo, 0, 0}` (el `DISP_CMD_LCD_SET_BRIGHTNESS` del kernel de Allwinner). Parcheé TWRP para usarlo cuando el dispositivo lo pide, y el control de brillo funciona.
- **Reiniciar a recovery.** Aquí U-Boot **ignora** el argumento de `reboot()`: ni `adb reboot recovery` ni el menú de TWRP entraban. Solo mira la partición `misc`. Hay que escribir el {{< g "bcb" "mensaje de arranque" >}} (`boot-recovery` en el desplazamiento 0 y `recovery\n` en el 64, 1088 bytes) antes de reiniciar. TWRP ejecuta `/sbin/rebootrecovery.sh` si existe, y ahí se escribe. Funciona, y TWRP borra el mensaje al arrancar para que no haya bucle.
- **Con botones.** El `script.bin` dice `[recovery_key] key_min=8 key_max=20`. Leyendo el registro del ADC del teclado (`0x01C2280C`) mientras pulsaba, **volumen + da 18** (dentro del rango) y volumen − da 24–25 (rango de modo de fábrica, 21–30). Con la tablet apagada: volumen + y encendido. Lo confirmé arrancando.

Un backup y un restore de TWRP probados de verdad: `boot` y `cache` se restauran con el `sha256` de `nandc` idéntico al original, y el `system` restaurado volvió a arrancar el Android de fábrica.

## El CM7: lo que fue fallando, en orden

El árbol de dispositivo (`device/allwinner/a10`) usa el kernel de fábrica y los blobs del stock. Compila a la primera, pero **no arrancaba**, y cada capa tuvo una causa distinta que se pudo demostrar:

1. **SurfaceFlinger caía en bucle.** `libUMP.so` del Android 4.0 importa `__popcount_tab`, un símbolo que el libc de ICS exporta y el de Gingerbread no. Lo peor: `libui` de Gingerbread sí lo tiene, pero el enlazador de Gingerbread **solo busca en las dependencias directas** de cada librería, y `libUMP` no depende de `libui`. Lo aporto desde `libcutils`, que sí es dependencia directa, con una tabla de 256 bytes que comprobé idéntica, byte a byte, a la de ICS.
2. **Datos de ICS en `/data`.** El proveedor de contactos encontraba una base de datos de versión 625 y no podía bajar a la 353. Hay que borrar `data` al cambiar de Android (hice antes un backup verificado).
3. **Memoria de Dalvik.** Sin `dalvik.vm.heapsize` el límite era de 16 MB y `system_server` moría decodificando el fondo de pantalla.
4. **`SystemUI` en bucle de caídas.** El código buscaba un recurso con un identificador y el APK lo tenía en otro: la caché de `out/target/common` se comparte entre dispositivos y quedaron clases de otra compilación. Borrar esos intermedios lo arregló. Lo detecté porque comparé los identificadores con `aapt` en vez de fiarme de "compila sin errores".
5. **La GPU.** Aquí estuvo el trabajo más delicado. El driver del kernel de la tablet es **Mali r2p4-02rel0**. Las librerías de usuario del stock son r2p4, pero las que encontré de un árbol público de Gingerbread son **r2p2**: no coinciden con el kernel. Usé las del stock (con el arreglo del punto 1). En este Gingerbread, `egl.cfg` es `0 0 android` (software) y `0 1 mali` (hardware). SurfaceFlinger pasó de *Android PixelFlinger* a **Mali-400 MP, OpenGL ES 1.1**, y la interfaz se siente más fluida (impresión mía, sin medirlo).
6. **CheckJNI.** Compilar `eng` lo activa y frena Dalvik. La variante `userdebug` falla en ProGuard con una app ajena, así que lo apago con `dalvik.vm.checkjni=false`, que `AndroidRuntime` prioriza.

## Sensores: el chip no era el que decía el stock

El Android original cargaba tres drivers de acelerómetro y el de `dmard06` registraba un dispositivo de entrada. Pero al leer el bus I²C directamente, en la dirección del DMARD06 (`0x1c`) **no responde nada**; en `0x4c` responde un acelerómetro con el mapa de registros exacto de un **MMA7660**. Con `mma7660.ko` cargado antes de `system_server` y el HAL del stock, el giro de pantalla funciona (tarda un poco, algo normal en Gingerbread). Un detalle que me costó un reinicio: tras un `rmmod` de ese módulo, con el sensor en uso, la tablet se reinició sola. No lo demostré, pero **no lo descargo en caliente**.

## Sin Bluetooth, sin SIM: lo que sobra

El `script.bin` dice `bt_used = 0` y el Wi-Fi es un Realtek por USB, no un combo. Leyendo el código vi que Android solo quita el interruptor de Bluetooth de Ajustes cuando no hay servicio, pero **deja el apartado** "Ajustes de Bluetooth". Hice un parche pequeño en `SystemServer` y en Ajustes, desactivado por defecto para no tocar otros dispositivos. Comprobé que el servicio ya no existe en el arranque, pero **no he mirado la pantalla de Ajustes**. Las apps `Mms`, `VoiceDialer` y `Bluetooth` son opcionales y no se pueden quitar con `filter-out`, porque `inherit-product` resuelve las listas después: hay que usar una base propia que no las incluya. Y los botones Inicio, Menú y Atrás aparecen en la barra de estado gracias a la función "Tablet tweaks" que CM7 ya trae (se activa con tres recursos).

## Wi-Fi: el estado real

Esta parte la dejo claramente marcada como **no terminada**. El módulo Realtek `8192cu` carga, pero en CM7 el dongle USB nunca se enumera. Hice una prueba A/B restaurando el Android original: allí **sí** conecta, con el mismo kernel y el mismo módulo, así que el fallo era mío. En `libhardware_legacy.so` del stock aparece la ruta `/sys/class/usb_wifi/rtl_wifi/usb_wifi` y los textos `usb_wifi on ..` y `start to isnmod rtl8192cu.ko` (la errata es de Allwinner). Por el orden de esas cadenas, y porque el archivo vale `1` con el Wi-Fi activo y `0` en CM7, **deduzco que la rutina del stock escribe `1` antes del `insmod`** y que eso alimenta el dongle; no desensamblé la función. Mi `wifi.c` estándar no lo hacía. Cuando lo escribí a mano **después** del `insmod`, la tablet se quedó colgada.

Ya está parcheado (solo se compila si el dispositivo define `WIFI_USB_POWER_SYSFS`) y verificado dentro del zip, pero **aún no lo he probado en la tablet**.

## Dos firmwares, o dos tablets

El primer volcado de la tablet decía build `20120725`, kernel del 26 de julio, con `dmard06` y Wi-Fi funcionando. El backup de TWRP era build `20120709`. Tengo dos unidades y sospecho que el volcado era de la otra, pero no lo comprobé. Las diferencias son de hardware (acelerómetro) y de firmware, y el adb las muestra con el mismo número de serie genérico de Allwinner.

## Lecciones de método

- **Verificar dentro del zip**, no solo "compiló sin errores". Así encontré tres cosas que parecían hechas: el `build.prop`, las apps sobrantes y el parche de reinicio.
- **`make` no rastrea las banderas del compilador.** Cambiar `CFLAGS` no recompila el objeto: borrar los intermedios. Tras cambiar propiedades, `make installclean`.
- **El adb por USB deja de responder mientras la tablet duerme**; lo vi con las marcas de hora del log. Un *wakelock* (`/sys/power/wake_lock`) para las pruebas largas.
- **Los datos de otra versión de Android rompen el arranque.** Backup verificado antes de borrar.
- Cuando algo "debería" existir y no existe, **leer el chip directamente** antes de fiarse del nombre del driver.

## Estado

| Funciona (lo vi en pantalla) | Compilado y verificado, sin probar | Pendiente |
| --- | --- | --- |
| Arranque, pantalla, táctil | Wi-Fi USB | Audio (stub) |
| GPU Mali, brillo en TWRP | Reiniciar a recovery desde el menú | Cámara (stub) |
| Acelerómetro y giro | Bluetooth fuera de Ajustes | Densidad de pantalla |
| Botones en la barra de estado | Sin Mensajes ni apps de teléfono | |
| Backup y restore con TWRP | | |

La cámara es un solo sensor `gc0308` (VGA), y el audio usa un códec `sun4i-CODEC` con salida HDMI. El siguiente paso es comprobar el Wi-Fi en CM7, y después el audio.
