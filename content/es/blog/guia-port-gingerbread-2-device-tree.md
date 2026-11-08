---
title: "Portar CM7 a un teléfono nuevo, 2/3: el device tree mínimo que arranca"
date: 2026-11-08
description: "Segunda parte: qué archivos necesita un device tree de CM7, qué va en BoardConfig.mk, cómo extraer los blobs sin perder el control y qué trampas de Gingerbread esperar."
tags: [android, cm7, guia, device-tree]
draft: false
---

Segunda parte de la guía, tras la [preparación]({{< relref "guia-port-gingerbread-1-preparacion.md" >}}). Aquí el objetivo no es que todo funcione: es que el sistema **arranque**. Todo lo demás es la [tercera parte]({{< relref "guia-port-gingerbread-3-bringup.md" >}}).

## La estructura

El {{< g "device-tree" "device tree" >}} del LG E400 tiene, entre otras cosas, esto:

```
device/lge/e400/
├── AndroidProducts.mk      # registra los .mk del producto
├── BoardConfig.mk          # hardware, particiones, flags de HAL
├── e400.mk, full_e400.mk, cyanogen_e400.mk
├── vendorsetup.sh          # añade el combo de lunch
├── recovery.fstab
├── init.e0.rc, ueventd.e0.rc
├── system.prop
├── extract-files.sh, setup-makefiles.sh, proprietary-files.txt
├── kernel                  # zImage prebuilt
├── overlay/, configs/, prebuilt/
├── libcamera/, libaudio/, ril/ ...   # HALs propios
└── patches/, docs/, tools/
```

Los blobs viven aparte, en `vendor/lge/e400/`, porque no son tuyos y no deben mezclarse con el código del device tree.

## BoardConfig.mk: lo que decide si arranca

Los valores de la parte 1 entran aquí. Del E400:

```make
TARGET_BOARD_PLATFORM := msm7k
TARGET_CPU_ABI := armeabi-v7a
BOARD_KERNEL_CMDLINE := androidboot.hardware=e0
BOARD_KERNEL_BASE := 0x00200000
BOARD_FORCE_RAMDISK_ADDRESS := 0x01300000
BOARD_KERNEL_PAGESIZE := 4096
BOARD_SYSTEMIMAGE_PARTITION_SIZE := 392167424
TARGET_PREBUILT_KERNEL := device/lge/e400/kernel
TARGET_USERIMAGES_USE_EXT4 := true
```

Después vienen los flags de gráficos y de cada HAL (`COPYBIT_MSM7K`, `BOARD_USES_QCOM_HARDWARE`, `BOARD_EGL_CFG`, Wi-Fi, Bluetooth, GPS, FM…). **Empieza con pocos**. Cada flag activa código de plataforma que asume cosas del hardware, y un flag mal elegido produce fallos que parecen de otro sitio. Añádelos cuando exista el síntoma que resuelven.

`recovery.fstab` y `BoardConfig.mk` tienen que decir lo mismo sobre las particiones. El E400, por ejemplo, monta `/boot` en `mmcblk0p9`, `/system` en `p14`, `/cache` en `p16` y `/data` en `p21`.

## Blobs: extraer con un script, no a mano

`proprietary-files.txt` lista, una por línea, las rutas de `/system` que hacen falta. `extract-files.sh` las baja con `adb pull` a `vendor/<fabricante>/<dispositivo>/proprietary`, y `setup-makefiles.sh` genera `*-vendor-blobs.mk` y `BoardConfigVendor.mk`. Así el proceso es repetible: otro puede regenerar `vendor/` desde un teléfono stock.

Dos cosas que aprendí:

- **Empieza con la lista mínima** y añade por síntoma. En el E400, `mediaserver` se caía porque faltaban `libOmxCore.so` y `libmm-omxcore.so`. El log lo dice sin rodeos.
- **No cambies blobs de framework.** Los del stock se compilaron contra *otro* framework: reemplazar `libsurfaceflinger.so` o `libpixelflinger.so` por los de fábrica dio pantalla blanca y luego negra. Los blobs son para la capa de hardware.

## Registrar el producto

El flujo `breakfast` de CM7 pasa por `AndroidProducts.mk`, `cyanogen_<dev>.mk` y una entrada en `vendor/cyanogen/products`. En el E400 hizo falta crear `vendor/cyanogen/products/cyanogen_e400.mk` y su línea en el `AndroidProducts.mk` de ese directorio, o `lunch` no encontraba el producto.

Y cuidado con `roomservice`: con `breakfast`, si no tienes tu repo en el manifiesto local, intenta traer el device tree de CyanogenMod y puede reapuntar tu carpeta. Yo prefiero `lunch cyanogen_<dev>-userdebug` y `make bacon`, con `USER` y `BUILD_NUMBER` definidos para que el zip no se llame `eng..zip`.

## Las trampas de Gingerbread al arrancar

- **`init.rc`**: Gingerbread no dispara `on post-fs-data`. En el E400, `init.e0.rc` lo usaba, nunca se creaba `/data/radio` y `qmiproxy` se comía el 90 % de CPU. Con `on post-fs` funciona.
- **`system.prop`** no regenera `build.prop`: bórralo antes de compilar tras cada cambio.
- **`mka bacon` compila todo `Android.mk`** del árbol. Un app roto en `packages/apps` rompe tu build aunque no lo uses.
- **ProGuard de FileManager** falla en `userdebug` (se arregló con `-dontwarn android.support.**`).

Para detalles de entorno, mira el [artículo del entorno]({{< relref "compilar-cm7-en-2026.md" >}}).

## Cuándo parar

El device tree mínimo está listo cuando: compila el zip, el teléfono llega a la animación de arranque y `adb logcat` muestra `system_server` vivo. Mira los logs con calma: casi todos los fallos de esta etapa están ya escritos ahí. La [tercera parte]({{< relref "guia-port-gingerbread-3-bringup.md" >}}) es ir encendiendo el hardware, una pieza por vez.
