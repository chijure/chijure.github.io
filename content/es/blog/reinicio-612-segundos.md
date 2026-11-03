---
title: "Un reinicio exacto a los 612 segundos"
date: 2026-10-31
description: "El LG L3 con kernel 3.4 se reinicia solo, sin panic, siempre entre los 609 y los 616 segundos de actividad. Con el kernel 2.6.38 y el mismo ramdisk, no pasa. Esto es lo que descarté y lo que queda sin resolver."
tags: [android, kernel, e400]
draft: false
---

Portar {{< g "cm" >}} 10.1 al **LG Optimus L3 (E400)** con un {{< g "kernel" >}} 3.4 (en vez del 2.6.38 que ya tenía andando) trajo un fallo que no había visto antes: el teléfono se reinicia solo, sin ningún {{< g "panic" >}} ni *oops* en el log, casi siempre entre los **609 y los 616 segundos** de actividad. Pasa incluso en reposo total, con la pantalla apagada. Después del reinicio, el bootloader arranca en modo carga.

## El resultado que lo acota

| Prueba | Resultado |
|---|---|
| Kernel 3.4 (cualquier variante que probé) | cae a 609–616 s, siempre |
| Kernel 2.6.38 + {{< g "ramdisk" >}} de CM9 | 1.480 s sin caer |
| Kernel 2.6.38 + el **mismo ramdisk de CM10.1** que usa el 3.4 | 1.850 s (30 min) sin caer |

La tercera fila es la que importa: con el mismo *userspace*, el mismo WiFi, el mismo Bluetooth y el mismo módem, cambiar solo el kernel decide si el teléfono se cae o no. **No es un problema de CM10.1, ni del hardware, ni del módem.**

## Lo que descarté

Probé, una por una y combinadas, las explicaciones más obvias y ninguna cambió el resultado:

- **Cargador o USB.** Con el cable desconectado y adb por Wi-Fi, cae igual.
- **Audio y el procesador de señal digital de audio (ADSP).** Mismo firmware AMSS en los dos kernels, mismo `rpc_server_dog_keepalive`.
- **Reposo profundo.** Lo apagué por completo (`idle_enabled` en 0, `nohlt` en la línea de comandos).
- **WiFi y Bluetooth por separado.** Encendidos, apagados, escaneando: igual.
- **Opciones de compilación exclusivas del 3.4**, apagadas de una en una y luego las once juntas: ningún cambio.
- **El código de motivo de reinicio** (`boot_reason=32`) no sirve de pista: también aparece en un arranque normal con USB conectado.

## Lo que queda abierto

Nada de lo anterior explica la caída, pero quedan algunas pistas sin cerrar:

- El tiempo es **casi fijo**: 613,6 s es, casi exactamente, 2³² dividido entre 7 MHz. Puede ser una coincidencia, pero no la descarté: habría que comparar cómo cuenta el tiempo cada kernel (`arch/arm/mach-msm/timer.c`) entre el 3.4 y el 2.6.38.
- Un canal de comunicación entre procesadores (el 38, llamado `DAL00`) queda abierto con tráfico en el 3.4 y cerrado en el 2.6.38. Lo abría el driver del conversor analógico-digital; apagarlo no cambió nada, pero puede haber otro cliente de ese canal.
- El último evento que vi antes de varias caídas fue el almacenamiento remoto escribiendo y el WiFi reasociando, entre 15 y 55 segundos antes del reinicio.
- Busqué en internet el mismo problema (MSM7225A, kernel 3.4, reinicio a los 10 minutos) y no encontré ningún caso igual. Solo material general sobre el *watchdog* de esta familia de chips y parches antiguos de desbordamiento del temporizador.

## Por qué lo dejé así

Tenía tres caminos: seguir comparando el 3.4 contra el 2.6.38 archivo por archivo (cada prueba tarda unos 11 minutos), portar Android 4.2.2 sobre el kernel 2.6.38 que ya es estable, o dejarlo como **problema conocido**: hoy el teléfono se reinicia solo cada 10 minutos y vuelve a Android sin que haya que tocar nada.

Elegí la tercera. El teléfono es usable así, y seguir mirando bits del temporizador sin una pista más fuerte que una coincidencia numérica no valía el tiempo. Si alguien reconoce este patrón en otro MSM7225A con un kernel 3.4, o sabe qué cambió entre `timer.c` de 2.6.38 y el de 3.4 en esta plataforma, me interesa saberlo.

El código de este port está en el [árbol del dispositivo](https://github.com/chijure-android-system-development/android_device_lge_e400) (rama `jellybean`) y el kernel en el fork [lge-kernel-lproj](https://github.com/chijure-android-system-development/lge-kernel-lproj), rama `android-msm-3.4-jb4.2-e0`.
