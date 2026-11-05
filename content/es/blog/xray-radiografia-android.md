---
title: "xray v1: una radiografía de Android antes de portar"
date: 2026-11-05
description: "xray recopila por adb lo que hay que saber de un teléfono Android antes de portarlo: SoC, particiones, fstab y kernel. Sin root, de Android 2.2 a 4.2."
tags: [android, herramientas, adb, xray]
draft: false
---

Compro teléfonos viejos para portarles CyanogenMod, y cada uno obliga a empezar igual: averiguar el SoC, la RAM, el kernel, cómo están repartidas las particiones, qué monta el `fstab` y si el flash es eMMC o NAND. Lo hacía a mano con `adb shell`, y cada equipo respondía distinto. **xray** hace esa primera pasada con un comando. Es una herramienta en Go, un solo binario para Linux, Windows y macOS, con licencia MIT. La probé en 13 equipos con Android de 2.2 a 4.2.2.

## Qué hace

- **Radiografía.** Propiedades, CPU, RAM, pantalla, GPU, sensores, particiones (`dumchar_info` de MediaTek, `/proc/mtd` en NAND o `/proc/partitions` en eMMC), los `init*.rc`, el `fstab`, paquetes, radio y kernel. Deja una carpeta por equipo con un `REPORTE.md` y un `INDEX.md` global.
- **Solo lectura.** No flashea ni borra nada. Lo único que escribe en el teléfono es un busybox opcional en `/data/local/tmp`, que borra al terminar.
- **`xray compare A B`.** Compara dos volcados y concluye si probablemente comparten device tree.
- **`xray bootinfo boot.img`.** Lee la cabecera de una imagen de arranque y entrega `BOARD_KERNEL_BASE`, el pagesize, la cmdline y los offsets de `mkbootimg`.
- **Qué falta.** Cada reporte termina con una lista de lo que aún no se pudo obtener para un TWRP, una ROM o un backup.

```text
$ xray -busybox ./busybox-armv7 -pull-system
[xray] Equipo: LGE LG-P500
[xray] Busybox cargado en /data/local/tmp/xray (se borra al terminar).
[xray] AVISO: sin root, se omiten datos protegidos.
[xray] Copiados 3 archivos init/fstab
[xray] Configuracion del kernel guardada (raw/kernel_config.txt).
[xray] AVISO: 6 rutas sin permiso omitidas (raw/pull_skipped.txt).
```

Salida abreviada. Con `-pull-system` baja `/system` sin root y propone una lista de candidatos a blob.

## Lo que aprendí con equipos reales

La herramienta se escribió primero contra la documentación y luego se corrigió contra los teléfonos. Estos fueron los fallos que solo aparecieron al conectarlos.

**El toolbox viejo no trae `head`, `uname` ni `wm`.** Seis comandos devolvían solo "not found". Ahora el recorte de líneas se hace en el PC y los mensajes de error se separan de los datos. Para el resto, `-busybox` sube un binario estático a `/data/local/tmp`. No uso `/sdcard` porque suele estar montada `noexec`.

**`adb pull` se detiene en el primer "Permission denied".** Bajando `/system` sin root se quedaba al 74 %. Ahora copia entrada por entrada y, si un directorio falla, baja sus archivos uno a uno y anota los omitidos.

**El `ls` de busybox imprime colores ANSI.** Con un adbd antiguo el shell usa un pseudo-terminal, y los nombres llegaban con códigos de escape que rompían `adb pull`. Se eliminan en un solo punto.

**Etiquetas que engañan al comparar.** Dos equipos con `ro.board.platform=msm7k` pueden tener CPU distinta (ARMv6 contra ARMv7). Un Y330 declara `mtk` y un Y321 no declara nada. `msm7x27a` y `msm7627a` son la misma familia. Y un `/proc/mtd` con solo la cabecera es eMMC, no NAND.

**Android 2.3 no acepta `pm list packages -s`.** Los paquetes de sistema y de usuario se separan ahora por la ruta del APK, que funciona en cualquier versión.

## Qué mostró la comparación

Estos resultados salen de equipos reales conectados por USB.

| Pareja | Resultado |
|---|---|
| Huawei Y320 y Y321 | Misma plataforma (MT6572) y 18 de 20 particiones idénticas. Cambia el reparto: `android` pasa de 750 a 950 MB y `fat` de 1530 a 1330 MB, con el mismo total. Todos los archivos init son idénticos. |
| Huawei Y200 y Y210 | Mismo SoC, pero el bloque NAND es de 128 KB en uno y 256 KB en el otro. Las imágenes yaffs2 y los parámetros de `mkfs` no se pueden compartir. |
| LG P350g y P500 | Ambos ARMv6 con el mismo bloque NAND. Cuatro particiones cambian de tamaño con el total igual. La RAM es muy distinta: 180 MB contra 428 MB. |
| Huawei Y330 y Y321 | Misma plataforma, pero el Y330 trae una partición `cust` de 192 MB y un mapa distinto. No sirve reutilizar el árbol tal cual. |

`bootinfo` lo contrasté con los `BoardConfig.mk` que ya tenía. En un Y210 coincidieron la cmdline, la base `0x00200000` y el pagesize de 4096. En un Y220, la base `0x10000000` y el pagesize de 2048.

## Lo que no hace

- No entrega el código fuente del kernel. Hay que buscarlo en el release GPL del fabricante.
- Sin root no extrae `boot.img` ni `recovery.img`, y en los LG con eMMC las particiones se ven solo por número. Con root, `--pull-boot` las vuelca. Sin root puedes pasar a `bootinfo` las imágenes del firmware de fábrica.
- La lista de blobs es un filtro por carpeta y por nombre. Hay que revisarla a mano.
- Los binarios de Windows y macOS compilan, pero no los he probado en esos sistemas. Es lo primero que agradecería que alguien verifique.
- Ningún reporte garantiza que un port arranque. Dice qué se sabe y qué falta.

## Herramientas parecidas

Busqué en GitHub antes de publicar y no encontré una que haga lo mismo, aunque algunas cubren partes:

- [twrpdtgen](https://github.com/SebaUbuntu/TWRP-Device-Tree-Generator) genera un device tree de TWRP desde un `recovery.img`. Se complementa con xray, que aporta la imagen y los datos. Su documentación habla de Android 4.4 a 12, así que con equipos de 2.x podría no servir.
- [android-partition-backup](https://github.com/HollowAOSP/android-partition-backup) vuelca particiones, pero requiere root y asume `by-name`.
- Los scripts `extract-files.sh` de los árboles de CyanogenMod, como [este](https://www.github.com/CyanogenMod/android_device_sony_common/blob/cm-14.1/extract-files.sh), copian blobs desde una lista `proprietary-files` escrita a mano.

## Descarga y licencia

El código y los binarios se publicarán en [mi GitHub](https://github.com/chijure). El código es MIT. El busybox opcional es GPLv2 y no está cubierto por esa licencia: usa el tuyo con `-busybox RUTA` o consulta su código fuente en [busybox.net](https://busybox.net/).

Si la pruebas en un equipo que no aparece aquí, me interesa saber qué comando devolvió algo vacío o raro. Casi todos los arreglos de esta versión vinieron de un teléfono nuevo que respondía de otra manera.
