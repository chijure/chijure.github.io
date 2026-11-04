---
title: "Probar el kernel del Huawei Y220-U05 sin arriesgar la ROM: TWRP primero"
date: 2026-10-12
description: "Antes de arrancar Android en el Y220-U05 con kernel propio, probé cada versión como recovery. Así monté el banco de pruebas y qué enseñó."
tags: [android, kernel, y220, twrp]
draft: false
---

El **Huawei Ascend Y220-U05** usa un MediaTek **{{< g "mt6572" "MT6572" >}}** con Android 2.3.6 de fábrica (compilación `C482B206SP05`). Para el port de {{< g "cm" "CyanogenMod" >}} necesitaba un {{< g "kernel" "kernel" >}} propio, y el punto de partida fue un árbol **donante** de Longcheer para Jelly Bean (`lcsh72_we_jb3`): un Linux 3.4.5 con soporte de MediaTek (su historial lo marca como importado desde un proyecto de Lenovo en 2014).

Este es el primero de dos artículos. Aquí cuento **cómo lo probé sin arriesgar el sistema del teléfono**; en el [segundo]({{< relref "kernel-y220.md" >}}) están los arreglos concretos del kernel.

## Punto de partida: no hay fuentes

Huawei nunca publicó el código fuente del kernel del Y220. Linux es {{< g "gpl" "GPL" >}}, así que ese código debería poder obtenerse, pero para este modelo no encontré nada: ni publicado por Huawei ni en repositorios de la comunidad. Tampoco encontré el árbol de otro aficionado que pudiera tomar como base.

Lo que sí tenía era el teléfono, su firmware de fábrica y el kernel binario que trae. Eso lo cambió todo:

- **Un {{< g "donor" "árbol donante" >}}.** Tuve que partir del kernel de *otro* teléfono con el mismo procesador (MT6572), que no es el Y220 y no coincide en panel, memoria ni sensores.
- **El kernel de fábrica como referencia.** Cada vez que el donante hacía algo distinto, comparaba con lo que hace el original: capturé del teléfono de fábrica las particiones, las propiedades y el `dmesg`, y **desensamblé la imagen del kernel de fábrica** para ver qué registros escribe, por ejemplo al iniciar el sensor de la cámara.
- **Mucha prueba y error.** Sin fuentes no hay manual: cada arreglo sale de comparar el comportamiento con el del equipo original. Por eso necesitaba probar los kernels sin arriesgar el sistema.

## Primero en TWRP, no en la ROM

Antes de tocar el Android del teléfono quise un sitio donde un kernel malo no costara nada. La respuesta fue **{{< g "twrp" "TWRP" >}}**. El Y220 tiene dos particiones de 6 MB, `boot` (`mtd7`) y `recovery` (`mtd8`). Los primeros kernels los probé como *{{< g "recovery" "recovery" >}}*: un TWRP con el kernel nuevo, escrito en `mtd8`, mientras el Android de fábrica seguía intacto en `boot`. Si el kernel no arrancaba, el teléfono conservaba su sistema y volver atrás era escribir otra imagen en recovery. (Las primeras imágenes de esta serie, del 7 y 8 de octubre, son recoveries.)

Montar ese banco de pruebas tuvo su propio trabajo:

- **Un árbol de TWRP para el Y220** (8 de octubre). Las cabeceras MTK las pone `mtkbootimg --mtk 1`, y `system`, `data` y `cache` son {{< g "ubifs" "UBIFS" >}}: `ubiattach` los monta en el orden de arranque de fábrica (`mtd14`, `mtd16`, `mtd15`).
- **Un límite exacto de 6 MiB.** El TWRP hubo que podarlo (solo los idiomas `en` y `es`, sin `sgdisk`) y el kernel tiene que ser pequeño. Hoy la imagen con el kernel `#92` queda 38 KB por debajo del límite.
- **Una forma de grabar que no es obvia.** `dd` a `mtdblock8` solo *borra* la partición; hay que borrar con `mtderase` y escribir con `nandwrite` sobre `/dev/mtd/mtd8`, y nunca sobre `mtd7`.
- **Una red de seguridad.** El teléfono no expone {{< g "fastboot" "fastboot" >}}. Si algo se rompía fuera del recovery, la salida era {{< g "sp-flash-tool" "SP Flash Tool" >}} v5 sobre el {{< g "preloader" "preloader" >}} (nunca la v6, y nunca *Format All*).

Los primeros kernels dejaron claro por qué convenía ese camino:

- **`#7`** arrancaba, pero el táctil msg2133 fallaba con `I2C transfer error` y la pantalla táctil nunca aparecía.
- **`#16`** ya reconocía el panel, pero sin las teclas capacitivas.
- **`#59`** (9 de octubre) fue una reconstrucción completa con la configuración del sistema: conserva las líneas de teclas (Menú, Inicio y Atrás) y el LED de los botones en el {{< g "gpio" "GPIO" >}} 141. Es el kernel que dejé fijo en el TWRP.

La conclusión quedó escrita en el README del árbol: **no se mete en el recovery un kernel de sistema sin probar**. Un experimento de `boot` malo no debe llevarse el recovery con él, así que el recovery conserva un kernel conocido (primero `#59` y luego `#92`) y es lo que queda para rescatar el teléfono.

Con el TWRP estable, el flujo de trabajo fue siempre el mismo:

1. `adb reboot recovery` y, desde ahí, `flash_image boot` con la imagen nueva.
2. `dump_image boot` y comparar los md5 antes de reiniciar.
3. Instalar los módulos montando `/system` desde el propio recovery.
4. Guardar siempre el `boot` anterior: en mi carpeta hay una imagen `boot-...-before-...img` por cada cambio importante.

TWRP resultó útil además como banco de diagnóstico. Escribe tan poco log que su `dmesg` conserva el arranque entero, y con él confirmé las direcciones del arreglo del logo de arranque. Restaurar el backup de fábrica desde TWRP me dejó hacer la comparación A/B con el kernel original: así descarté que el "solo llamadas de emergencia" viniera del kernel. Y también tuvo sus propios errores: tras un backup o restore grandes, UBIFS no encontraba un bloque contiguo de unos 248 KB para montar y fallaba con `Out of memory`; lo resolví con un script que suelta la caché cuando pasa de 32 MB.

## Y después

Con ese banco de pruebas en su sitio, el trabajo fue arreglar el kernel, kernel tras kernel: panel, memoria, cámara, carga con el teléfono apagado, Wi-Fi y punto de acceso. Todo eso, con los commits y las causas, está en [el segundo artículo]({{< relref "kernel-y220.md" >}}). Los kernels que menciono aquí son los de la partición de recovery; el código está en el repositorio [android_kernel_huawei_y220-u05](https://github.com/chijure-android-system-development/android_kernel_huawei_y220-u05) y el árbol de TWRP en [android_device_huawei_y220](https://github.com/chijure-android-system-development/android_device_huawei_y220).
