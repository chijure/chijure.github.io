---
title: "Compilar CyanogenMod 7 en 2026: el entorno y las trampas"
date: 2026-11-08
description: "Cómo compilo CM7 (Gingerbread) hoy: contenedor Ubuntu 12.04, ccache, un árbol compartido por cuatro teléfonos y los problemas que costaron más de una build."
tags: [android, cm7, build, docker]
draft: false
---

Ya tengo varios teléfonos corriendo {{< g "cm" >}} 7 casi estables: el Huawei Y210, el Y220, el LG C660 y el LG E400. Antes de contar cada port, esto es lo que se repite en todos: **cómo se compila un Android de 2011 en una máquina de 2026**, y las trampas que me costaron una build fallida cada una.

## El entorno: un contenedor de 2012

{{< g "gingerbread" >}} no compila con un toolchain moderno: necesita `openjdk-6`, `gcc-multilib` de la época y Python 2. Instalar eso en el host sería ensuciarlo (y casi imposible en un Ubuntu actual), así que compilo dentro de un contenedor **Ubuntu 12.04**:

- La imagen apunta los repositorios a `old-releases.ubuntu.com`, porque los mirrors normales de 12.04 ya no existen.
- Se crea un usuario `builder` con el mismo UID/GID del host, para que el árbol montado (`~/cm7`) no se llene de archivos de root.
- Se montan el código, un directorio de ccache propio y los objetos auxiliares. Compose lo deja como `cm7-builder`.

El árbol es un checkout normal de CM7 `gingerbread` con `repo`, más mis device trees. La compilación se lanza con un script que mide el tiempo y deja el log, el tamaño y el md5 del zip:

```bash
docker exec -it cm7-builder bash -c 'DEVICE=y210 ./timed_build.sh'
# breakfast → lunch cyanogen_y210-eng → mka bacon
```

Aun así, el código de 2011 necesita retoques para compilar con el host actual (cabeceras, `javac -source 1.5`, `apriori`). Esos cambios viven en `build/` y son del entorno, no de ningún teléfono.

## La máquina

Nada exótico, una torre de 2014:

| | |
|---|---|
| CPU | Intel Core i7-4770S, 4 núcleos / 8 hilos, 3,10 GHz |
| RAM | 23 GiB |
| Disco | SSD SATA de 256 GB (el sistema y el árbol comparten partición; ~24 GB libres de 218) |
| Sistema | Ubuntu 24.04.5, kernel 7.0 |
| Docker | 28.1.1 |

El directorio `out/` ocupa unos 11 GB y la caché de ccache otros 2,7 GB (límite de 15 GB). Con 8 hilos y 23 GiB parecería sobrar para `-j8`, pero con la memoria que ya ocupa el escritorio compilo con `-j2` (ver el punto 3). Con la caché caliente, las builds incrementales de estos días tardan entre 90 y 200 segundos.

## Un árbol, cuatro teléfonos

Y210, C660 y E400 comparten plataforma Qualcomm; el Y220 es MediaTek. Todos conviven en **el mismo checkout**. Cada device tree trae un `patches/` con un `apply-patches.sh` y un `revert-patches.sh` para los cambios que tocan proyectos compartidos (`frameworks/base`, `external/*`). Antes de trabajar en uno, revierto los parches de los otros.

Esto funciona, pero tiene un riesgo real: un `revert-patches.sh` que hace `reset --hard` de `frameworks/base` puede llevarse por delante un commit que nunca llegó a ser parche. Me pasó con uno del Y210. La regla que saqué: todo cambio en un proyecto compartido tiene que existir como parche **antes** de que alguien revierta.

## Los retos, en orden de dolor

### 1. ccache que nunca guardaba nada

Compilaba "con ccache" y cada build tardaba lo mismo. `ccache -s` mostraba 39 hits contra 2484 misses: el `~/.ccache` había quedado con dueño root y ccache no podía escribir. Ahora el contenedor monta `~/.ccache-cm7`, propiedad del usuario, con `CCACHE_DIR` explícito. Con la caché caliente una build incremental es otra cosa.

### 2. Docker Desktop y los archivos "viejos"

En Docker Desktop el árbol se comparte con una VM con caché. Si el contenedor está corriendo y git **reemplaza** un archivo (`checkout`, `reset`, `apply -R`), la ruta puede quedar apuntando a un inodo viejo dentro del contenedor: el host ve el archivo nuevo, el compilador el anterior. Lo que se hizo antes de arrancar el contenedor se ve bien. Tras cada operación git comparo `md5sum` host contra contenedor, o reinicio el contenedor antes de compilar. En el E400 pasé a Docker Engine y el problema no aparece.

### 3. Una build cortada deja basura con fecha nueva

Si la máquina se queda sin memoria a media build, quedan `.apk`, `.jar` o `.so` truncados con fecha reciente, y la build incremental los da por buenos. Me pasó con un `LatinIME.apk` de 8,8 MB en lugar de 15: la ROM arrancó sin teclado. Ahora, tras cualquier corte, valido lo escrito en esa ventana (`zipfile.testzip`, cabecera dex, ELF) y hago `unzip -tq` de todos los apk del zip final antes de flashear. Y compilo con `-j2`: con `-j4`, `systemd-oomd` terminó matando también el editor.

### 4. `build.prop` no se regenera

En Gingerbread, cambiar `system.prop` no invalida `build.prop`. El síntoma era un zip con la fecha vieja en el nombre y una propiedad (`rild.libpath`) que seguía apuntando al blob en vez de al shim. Ahora borro `out/target/product/<dev>/system/build.prop` después de tocar `system.prop`.

### 5. `breakfast`, `lunch` y el nombre del zip

`breakfast` siempre termina en `-eng` aunque el script imprima `-userdebug`, y `userdebug` falla en ProGuard de FileManager. Además, con `roomservice` activo, `breakfast` apuntaba `device/lge/e400` al repo de CyanogenMod en lugar del mío. Para el E400 uso `lunch cyanogen_e400-userdebug` y `make bacon` con `USER` y `BUILD_NUMBER` definidos: si `USER` queda vacío, el zip se llama `eng..zip` y el squisher no lo encuentra.

### 6. `mka bacon` compila todo

Compila **cada** `Android.mk`, aunque el paquete no esté en `PRODUCT_PACKAGES`. Una app rota en `packages/apps` rompe la build entera. Las apps de fábrica de Huawei (decompiladas, que no compilan) quedaron detrás de un `ifeq`.

### 7. Los blobs del stock no son intercambiables

Cuando algo falla es tentador copiar la librería del stock. En el E400 probé `libsurfaceflinger.so` y luego `libGLES_android.so` + `libpixelflinger.so` del stock dentro de CM7: pantalla blanca, luego negra. Las libs de framework del stock están compiladas contra *otro* framework. Los blobs sirven para HAL y vendor (cámara, OMX, RIL), no para el framework.

## Flashear sin tocar el teléfono

Con TWRP, todo por `adb`: se copia el zip a la SD, se escribe `/cache/recovery/openrecoveryscript` con `install`, `wipe cache` y `wipe dalvik`, y `adb reboot recovery`. Unos dos minutos hasta `boot_completed`. Un detalle: no encadenar `twrp wipe` justo después de `twrp install`, da "Another threaded action is already running".

## Los bugs de dispositivo que no eran de la build

Compilar es la mitad. Algunos de los que más tiempo costaron:

- **Y210, radio FM sin audio:** faltaba `audmgr_enable()` por `/dev/msm_fm` antes del RPC de audio.
- **E400, rayas al rotar:** la captura de pantalla de SurfaceFlinger leía `fb0` con filas de 480 bytes; el stride real de `msm_fb` es 512. Se corrigió con `line_length` de `FBIOGET_FSCREENINFO`.
- **E400, ROM lenta y sin radio:** `init.e0.rc` usaba `on post-fs-data`, que Gingerbread no dispara; con `on post-fs` funciona.
- **E400, verde en pantalla:** el kernel del árbol no era el del stock; con el `zImage` stock desaparece.
- **Y220, carga con el equipo apagado:** un `panic()` de diagnóstico que se coló en un commit colgaba el kernel a los ~10 s. Lección: mirar `last_kmsg` antes de teorizar.

## Lo que me llevo

1. Contenedor viejo para el código viejo, y el host sin tocar.
2. Verificar siempre que lo que ve el compilador es lo que hay en el host.
3. Desconfiar de cualquier artefacto escrito durante un corte.
4. Todo cambio en un proyecto compartido, como parche, antes de revertir nada.

Los device trees están en [chijure-android-system-development](https://github.com/chijure-android-system-development). Si compilas algo igual de viejo y te topas con otra trampa, cuéntamela.
