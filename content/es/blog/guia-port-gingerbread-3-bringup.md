---
title: "Portar CM7 a un teléfono nuevo, 3/3: bring-up por etapas y cómo mantenerlo"
date: 2026-11-08
description: "Tercera parte: encender gráficos, radio, Wi-Fi, cámara y audio de uno en uno, con pruebas repetibles, y cómo mantener parches, notas y repos para que el port no se pudra."
tags: [android, cm7, guia, bring-up]
draft: false
---

Tercera y última parte. Ya tienes un [device tree que arranca]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}); ahora hay que lograr que el teléfono *sirva*. La regla de esta etapa es una sola: **una pieza de hardware por vez, con una prueba antes y otra después**.

## El orden que me funcionó

1. **Gráficos** ({{< g "gralloc" >}}, copybit, {{< g "framebuffer" >}}). Sin pantalla estable no puedes juzgar nada más.
2. **Radio/RIL** y Wi-Fi.
3. **Cámara y video**.
4. **Audio, FM y Bluetooth**.
5. **Detalles**: carga con el equipo apagado, GPS, USB, rotación.

### Gráficos

Aquí aparecen los bugs más engañosos porque se ven como fallos de la aplicación. Dos casos del E400:

- **Rayas al rotar con el sensor.** La captura de pantalla de SurfaceFlinger copiaba `fb0` con filas de 480 bytes (`xres*bpp`), pero el stride real de `msm_fb` es 512. Cada fila se desplazaba 32 bytes. El parche usa `line_length` de `FBIOGET_FSCREENINFO`. Antes de dar con eso descarté copybit, composition bypass y el kernel.
- **Verde en pantalla:** era el kernel del árbol, no el código (parte 1).

### Radio y Wi-Fi

- En el E400, el escaneo Wi-Fi no encontraba redes: `WifiStateTracker` bajaba `wlan0` al desconectar y los escaneos siguientes corrían con la interfaz caída. El log lo mostraba (`Disabling interface` justo tras `Scan requested`). Además, `driver_wext.c` no debe fallar si `SIOCSIWFREQ` devuelve `EOPNOTSUPP`, o no asocia.
- Un RIL mal conectado se nota en la CPU (`qmiproxy` al 90 %), no solo en la señal.

### Cámara

La mía es siempre la misma receta: un wrapper de HAL en el device tree que carga el blob del stock con `dlopen` y lo llama sin tocar el código de plataforma. En el E400 funcionó con preview y foto de 2048×1536 correctas. Las trampas fueron el linker de Gingerbread (resuelve pocos símbolos) y la tabla virtual del blob. Es un tema para un artículo propio.

### Audio y FM

Aquí la regla es **comparar con el stock corriendo**. En el Y210, la radio FM no daba audio tras muchas hipótesis descartadas; la causa era que faltaba `audmgr_enable()` por `/dev/msm_fm` antes del RPC de audio. Salió de capturar `dmesg` del stock y repetir su secuencia.

## Pruebas repetibles, no a ojo

Cada pieza arreglada tiene que poder comprobarse de nuevo. En el Y220 mantengo `tools/test_y220.sh`, que por `adb` revisa por secciones (zip, boot, display, audio, wifi, bt, fm, sensores, ril, storage, power) y marca lo que requiere prueba manual. Dos comprobaciones útiles:

- **Sección `zip`:** comprueba que cada `.apk`/`.jar` del zip final sea un zip válido, antes de flashear.
- **`tools/blobcheck`:** compara los blobs de la ROM con los del stock tras cada build.

Y un hábito que me ahorró horas: **tras cada cambio, `adb logcat` y `dmesg`**. Y tras un reinicio inesperado, mirar {{< g "last-kmsg" "last_kmsg" >}} antes de teorizar. Un `panic()` de diagnóstico que se coló en un commit colgaba el Y220 a los 10 segundos, y la pista estaba en ese log.

## Mantener el port

Un port que arranca hoy se rompe en un mes si no se cuida.

### Parches en vez de ediciones sueltas

Los cambios que tocan proyectos compartidos (`frameworks/base`, `external/*`) viven en `patches/` dentro del device tree, con `apply-patches.sh` y `revert-patches.sh`. Mi regla, tras perder un commit: **todo cambio en un proyecto compartido existe como parche antes de que alguien revierta**. Y prefiero resolver diferencias de hardware en el device tree con HALs y shims, y dejar el parche de plataforma como último recurso ([por qué]({{< relref "hals-y-shims.md" >}})).

### Notas y documentación

`docs/<DEVICE>_NOTES.md` con lo que se probó y descartó, por pieza. Es lo más valioso cuando retomas el port tres semanas después: evita repetir diagnósticos.

### Repos y publicación

Device tree, vendor y kernel en repos propios con una rama `gingerbread`, commits pequeños y un `README` con cómo compilar. Los zips, en releases del repo. Si lo anuncias, enlaza todo desde un mismo sitio.

## Cierre de la serie

1. [Preparación]({{< relref "guia-port-gingerbread-1-preparacion.md" >}}): backup verificado, datos del stock, recovery.
2. [Device tree]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}): `BoardConfig.mk`, blobs, producto.
3. Bring-up y mantenimiento (esta).

Es menos glamuroso que un parche brillante, pero casi todos mis días perdidos vinieron de saltarme un paso de estas listas, no de un problema de hardware difícil.
