---
title: "Kernel 3.4 para el LG L3 (E400): de un teléfono que se reiniciaba solo a CM10.1 con GPS, sensores y cámara"
date: 2026-11-03
description: "El LG L3 (MSM7225A) traía un kernel 2.6.38. Llevarlo a 3.4 para Android 4.2.2 fue una cadena de reinicios sin log, casi todos por el módem."
tags: [android, kernel, e400, qualcomm]
draft: false
---

El **LG Optimus L3 (E400)** es un teléfono de 2012: Qualcomm **MSM7225A**, pantalla de 320x240, 384 MB de RAM (unos 299 MB para Android) y un kernel 2.6.38 de fábrica. Ya tenía {{< g "cm" "CyanogenMod" >}} 7 y 9 funcionando. Quise llevarlo a **CM10.1 (Android 4.2.2)** sobre un {{< g "kernel" "kernel" >}} **3.4**, como los hermanos L5 y L7. Este artículo cuenta el camino y los fallos que hubo que desarmar. Continúa el [reinicio de los 612 segundos]({{< relref "reinicio-612-segundos.md" >}}), que ahora tiene un final distinto.

## Punto de partida

No existía una placa **e0** para 3.4. Partí del fork de TeamHackLG (`lge-kernel-lproj`), que trae las placas vee3, v1, m4 y otras, todas del mismo SoC. Creé la placa `e0` reutilizando la de la vee3 (`MACH_MSM7X25A_E0` la selecciona para heredar Bluetooth, cámara, almacenamiento, WiFi y regulador) con su propio código en `arch/arm/mach-msm/lge/e0/`. La rama útil fue la `jb42`: trae {{< g "pmem" "PMEM" >}} (con el que arrancó CM9) e {{< g "ion" "ION" >}}, y la `kk` solo ION. Con CM10.1 acabé usando ION para el gralloc, la cámara y los buffers de medios, como en el L5 y el L7.

El método es el de siempre cuando no hay margen de error:

- El kernel se compila en el PC con `arm-eabi-4.6` (el 4.4.3 no sirve).
- La imagen de arranque se rearma con un script de Python (formato v0, página de 4096), se escribe con `dd` en la partición `boot` y se comprueba el md5. Antes se guarda copia de la anterior.
- Lo primero que arranca con el 3.4 es la partición de **{{< g "recovery" "recovery" >}}**, no la del sistema. Si falla, el sistema sigue intacto. Es la misma idea que conté con el [Y220 en TWRP]({{< relref "y220-twrp-primero.md" >}}).
- Para ver qué falla uso {{< g "last-kmsg" "`last_kmsg`" >}} y el [QApp]({{< relref "qapp-probar-sin-adivinar.md" >}}), el programa de pruebas de LG, que recorre todo el hardware.

## El módem lo explica casi todo

Con el 3.4 y el userspace de CM9, el teléfono arrancaba y se reiniciaba a los 35 segundos, sin {{< g "panic" "panic" >}} y sin nada en el log. Apagando `rild` (el demonio de la radio) quedaba estable: el culpable era la radio. El teléfono es un MSM: el procesador de Android y el módem ({{< g "amss" "AMSS" >}}) son dos procesadores que se hablan por {{< g "oncrpc" "RPC" >}}, y el módem tiene una costumbre: **si algo no le cuadra, reinicia el chip entero** sin avisar. Lo vi con estos disparadores:

| Qué lo disparaba | Causa | Arreglo |
|---|---|---|
| Abrir el micrófono o la voz (y, con casi seguridad, `rild` a los 35 s) | La tabla de *endpoints* de audio del 3.4 usa los identificadores de Qualcomm (auricular 0, altavoz 6). El AMSS del E400 usa los viejos de LG (auricular 6, altavoz 0) | Copiar la tabla de `board-e0eu-sound.c` del 2.6.38 |
| Encender el GPS | El módem llama a un servidor RPC del lado Android que el 3.4 no tiene | Un servidor nuevo (ver abajo) |
| Cada ~10 minutos | Desapareció al restaurar el firmware de fábrica entero | Ver el final |

### El GPS: un servidor que faltaba

Al pedir una posición, el módem llama al programa RPC `0x30000006` (`misc_apps_apis`) para preguntar el país y el operador (MCC, MNC, nombre y país del archivo `flex`). El kernel 2.6.38 de LG tiene ese servidor. El 3.4 de TeamHackLG no, y el módem, sin respuesta, reinicia el chip unos 10 segundos después. Sin log, con el teléfono muriendo en silencio.

Para verlo activé el depurado del router (`smd_rpcrouter/parameters/debug_mask`) y escribí un programa Java mínimo que pide la ubicación por `app_process` como uid 1000 (como root, `LocationManager` rechaza el uid 0). El arreglo está en `rpc_misc_e0.c`: un servidor que registra el programa y contesta con una respuesta vacía de 532 bytes (cabecera de 24, dos enteros y una cadena de 500), igual que la del kernel de fábrica cuando no hay datos de `flex`. Desde entonces el GPS abre sesión de 30 a 40 segundos sin reiniciar, y la prueba completa del QApp pasa entera. El teléfono además se siente más estable, y es probable que este servidor cubriera otros reinicios raros.

## Sensores: cuatro causas para un mismo síntoma

El QApp decía "sin sensores". Hubo cuatro motivos distintos y hacía falta quitar los cuatro:

1. **Pines equivocados.** El archivo `board_v3.h` solo aplicaba los pines I2C del E0 en el bloque de otra variante (V7); el bloque V3 dejaba los de la vee3 (13 y 35, en vez de 49 y 48). El acelerómetro y la brújula no contestaban en el bus.
2. **Una línea duplicada en el defconfig.** `CONFIG_SENSOR_GP2AP` aparecía dos veces y la segunda decía *is not set*. Gana la última.
3. **El sensor de proximidad sin alimentación.** El driver del 3.4 tenía comentada la llamada que lo enciende. En el E400 lo alimenta el LDO1 del chip de retroiluminación BU61800.
4. **`sensord`, el demonio de Bosch.** Hay que ejecutarlo como root (crea unos FIFO en `/data/local/tmp` y escribe atributos de sysfs) y con `umask 0`, porque `init` usa 077 y los FIFO quedaban en 0600: `system_server` no podía abrirlos y el sistema veía 0 sensores. Además `sensord` busca la proximidad en un bus I2C fijo (`i2c-4`), así que registré ese bus antes que el de los sensores.

Resultado en el QApp: acelerómetro, brújula y proximidad en verde. El teléfono no tiene giroscopio ni sensor de luz.

## Teclas táctiles, WiFi y otros

- **Atrás actuaba como Home.** Había copiado el mapa de teclas de otro L3, con cuatro teclas. El E400 solo tiene dos: izquierda `MENU`, derecha `BACK` (`mms128s_ts.c`).
- **Conectar a una red WiFi reiniciaba el teléfono.** Faltaba un parche de *wireless extensions* en el kernel compilado.
- **El WiFi en sí** solo cargó con un `wlan.ko` del L5 con el mismo {{< g "vermagic" "vermagic" >}} (`-perf-g22f2f4c`) y los mismos CRC de módulo; para eso hubo que apagar el trazado del kernel (`CONFIG_MACH_LGE_NO_DEBUG_INFO`), que cambiaba la estructura de los módulos.
- **Bluetooth** con el `libbt-vendor` de TeamHackLG, y la radio con las bibliotecas de RIL del L5.

## La cámara: un ABI que no coincide

El HAL de cámara que usa CM10.1 en esta familia es un binario propietario (`vendor-camera.msm7x27a.so`, de TeamHackLG). Con él la vista previa iba llena de errores `Cache clean … 0xffffffff`. Con `strace` sobre `mediaserver` vi la pista: `mmap(NULL, 0, …) = -1 EINVAL`. Un `mmap` de tamaño 0.

La causa era un **ABI de {{< g "gralloc" "gralloc" >}}**. El binario espera un `private_handle_t` con 3 descriptores de archivo y lee el tamaño del buffer en el offset 32 y el desplazamiento en el 36. Nuestro gralloc (el `display-legacy` de CM) tiene 2 descriptores: esos campos están en el 28 y el 32. El HAL leía el campo `offset` (0) como si fuera el tamaño.

Reconstruir todo el stack gráfico con el layout de 3 descriptores (gralloc, genlock, HWC y probablemente las bibliotecas de Adreno) era un trabajo enorme y arriesgado: ya lo había intentado y `surfaceflinger` caía en bucle. La salida fue **parchear el binario**: encontré en el desensamblado las 9 instrucciones `ldr` de 16 bits que leen esos campos en las funciones de vista previa y de grabación, y le resté 4 al desplazamiento de cada una (`size` pasa de `[r, #32]` a `[r, #28]` y `offset` de `#36` a `#32`). Un script comprueba que cada dirección contiene el código esperado antes de escribir. Con eso salen fotos de 2048x1536.

### El video, en tres tropiezos

1. **Un encoder que no llega a 480p.** El único encoder H.264 del sistema es el de software, y falla con `AVCENC_LEVEL_FAIL` a 640x480 y 30 fps. Con su nivel por defecto solo caben QVGA y CIF, así que quité los perfiles de 480p de `media_profiles.xml`. (Ese archivo se carga una vez en el *zygote*: tras cambiarlo hay que reiniciar el framework.)
2. **El video debe tener el tamaño de la vista previa.** En este HAL el video sale de los mismos cuadros de la vista previa, pero anuncia 640x480 como tamaño de video por defecto. El wrapper de cámara ahora iguala el tamaño de video al de la vista previa cuando la app va a grabar.
3. **Buffers de tamaño distinto.** El encoder rechazaba cada cuadro: "input buffers are too small" (460800 contra 462848). 462848 es el tamaño del buffer de gralloc alineado a página; 460800, el del cuadro real. El wrapper devuelve al HAL memoria con el tamaño exacto del cuadro.

Resultado: video H.264 de 352x288 con audio y la imagen correcta. El límite es el encoder de software: es lento y fuerza el CIF.

## El final del reinicio de los 612 segundos

El artículo anterior dejaba ese reinicio como problema abierto. Tras instalar el 3.4 con el firmware de fábrica del teléfono **restaurado por completo** (incluidos los datos de módem y de NV), **dejó de pasar** con el mismo kernel y el mismo ramdisk. No era el código del 3.4: lo disparaba el estado de ese teléfono. No sé qué pieza concreta cambió (restaurar el stock rehace varias particiones a la vez) y no pude reproducirlo después, así que lo doy por cerrado en la práctica, no por explicado.

## Lo que me llevo

- **Cuando un MSM se reinicia sin log, mira primero lo que el módem le pide a Android.** Los reinicios de audio y de GPS eran una pregunta sin respuesta o con un identificador equivocado.
- **Compara con el kernel de fábrica antes de teorizar.** Casi todos los arreglos salieron de leer qué hace el 2.6.38 de LG (la tabla de audio, el servidor RPC, los pines) y copiarlo.
- **Si un binario propietario falla por un ABI, a veces el parche de 9 instrucciones vale más que recompilar el mundo.** Pero solo si puedes verificar cada dirección.
- **Probar en la partición de recovery** me ahorró reflashear el sistema decenas de veces.

## Estado y código

Funcionan: pantalla, táctil con sus dos teclas, WiFi, Bluetooth, audio, GPS, sensores y cámara (fotos y video CIF). Falta probar la SIM: no tengo una del operador al que está atado el teléfono.

El código está en el fork del kernel [lge-kernel-lproj](https://github.com/chijure-android-system-development/lge-kernel-lproj) (rama `android-msm-3.4-jb4.2-e0`) y en el [árbol del dispositivo](https://github.com/chijure-android-system-development/android_device_lge_e400) (rama `jellybean`). Los binarios propietarios están en un repositorio aparte, privado.
