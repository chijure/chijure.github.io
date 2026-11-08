---
title: "Portar CM7 a un teléfono nuevo, 1/3: qué reunir antes de escribir código"
date: 2026-11-08
description: "Primera parte de una guía para portar CyanogenMod 7 en 2026: datos del stock, backup verificado, parámetros del boot.img, particiones y el kernel de partida."
tags: [android, cm7, guia, port]
draft: false
---

Esta es la primera de tres partes sobre cómo portar {{< g "cm" "CyanogenMod" >}} 7 ({{< g "gingerbread" >}}) a un teléfono nuevo. Las guías de la época (la más conocida es la *Porting Intro* de la wiki de CyanogenMod) siguen valiendo para el esquema general. Esta serie cuenta lo que yo añadiría después de cuatro ports (Huawei Y210 y Y220, LG C660 y E400), sobre todo lo que cambia al hacerlo en 2026. El entorno de compilación está en [otro artículo]({{< relref "compilar-cm7-en-2026.md" >}}).

Las partes: **1. preparación** (esta), [2. el device tree mínimo]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}) y [3. bring-up y mantenimiento]({{< relref "guia-port-gingerbread-3-bringup.md" >}}).

## 1. Un backup del stock... que de verdad sea stock

Antes de flashear nada, una copia completa del sistema de fábrica: `boot`, `recovery`, `system` y, si se puede, las particiones del módem. Parece obvio, pero con el E400 el backup que yo creía de fábrica resultó ser **un CM7 anterior** (su `/system` decía `CyanogenMod-7`, no `lge/e400`). Lo detecté comparando el `ro.build.fingerprint` del backup con el del teléfono. Hazlo siempre: si el backup no es stock, no sirve como referencia ni como vuelta atrás.

Un backup real también te da dos cosas que vas a usar todo el port: los **blobs** y el **kernel** de fábrica. Y conviene empaquetar un zip de restauración (en el Y220 hice uno desde el backup de TWRP, y probé que instala y que el stock arranca).

## 2. Qué leer del teléfono

Con `adb` y el stock corriendo:

- **`/system/build.prop`**: `ro.product.manufacturer`, `ro.product.device` (el nombre en clave) y el fingerprint. Con eso eliges los nombres de carpeta y compruebas versiones.
- **Particiones**: `/proc/partitions`, `/proc/mounts` y el `recovery.fstab` del stock si lo trae. Anota el bloque de cada punto de montaje y los tamaños; van directo a `BoardConfig.mk`.
- **`boot.img`**: desempaquétalo y apunta la base del kernel, la dirección del {{< g "ramdisk" >}}, el tamaño de página y la línea de comandos. En el E400 son `BOARD_KERNEL_BASE := 0x00200000`, `BOARD_FORCE_RAMDISK_ADDRESS := 0x01300000`, `BOARD_KERNEL_PAGESIZE := 4096` y `androidboot.hardware=e0`. Un valor equivocado aquí da un teléfono que no arranca y no dice por qué.
- **Tamaños de imagen y bloque**: `BOARD_SYSTEMIMAGE_PARTITION_SIZE`, `BOARD_USERDATAIMAGE_PARTITION_SIZE` y `BOARD_FLASH_BLOCK_SIZE` salen de las particiones reales.

Guarda todo en un archivo de notas por dispositivo desde el primer día. Yo uso `docs/<DEVICE>_NOTES.md` dentro del device tree.

## 3. El kernel de partida

Tienes tres opciones, de más segura a más arriesgada:

1. **El `zImage` del stock**, extraído del `boot.img`. Es lo que menos sorprende.
2. Un kernel del árbol de un equipo parecido, compilado de fuente.
3. Un kernel propio, desde el código que publique el fabricante.

Mi experiencia: **empieza por el del stock** y cambia solo cuando tengas un motivo medible. En el E400 el kernel que traía el device tree que yo había heredado producía pantalla verde al abrir la cámara y errores `mdp_ppp: invalid image`. Con el `zImage` del stock desapareció (0 de 40 cuadros verdes en tres corridas). No era un bug de mi código: era un kernel distinto del de fábrica.

Solo recompilé kernel cuando hacía falta de verdad, como en el C660, donde el prebuilt traía el teclado físico apagado a nivel de kernel.

## 4. Recovery primero

Antes de probar una ROM, una {{< g "recovery" >}} fiable. Sin ella, cada prueba mala es un teléfono que hay que rescatar por otros medios. Con una recovery que funciona haces `adb push` del zip, instalas, y si algo falla restauras el backup. Cómo la probé en cada caso:

- Y220: probé cada versión del kernel como recovery antes de arrancar Android ([TWRP primero]({{< relref "y220-twrp-primero.md" >}})).
- C660: una {{< g "twrp" "TWRP" >}} que cupiera en 5 MB ([la historia]({{< relref "twrp-5mb-c660.md" >}})).

## 5. Elegir de dónde partir

No empieces con un árbol vacío si existe uno de un equipo con el mismo SoC. Mis ports salieron de forks de device trees de plataforma parecida (MSM7x27a), y ajusté de ahí. Lo que **no** conviene es heredar a ciegas: revisa `BoardConfig.mk`, `init.*.rc` y los blobs contra tu stock. En el E400 tres problemas (kernel, `post-fs-data` y blobs de OMX) venían de fiarme del árbol heredado.

## Lista de comprobación

- [ ] Backup con fingerprint verificado como stock
- [ ] `build.prop`, particiones y parámetros del `boot.img` anotados
- [ ] `zImage` del stock extraído
- [ ] Recovery que arranca, monta y flashea
- [ ] Contenedor de build funcionando con un build de otro equipo conocido

En la siguiente parte pasamos al [device tree mínimo]({{< relref "guia-port-gingerbread-2-device-tree.md" >}}).
