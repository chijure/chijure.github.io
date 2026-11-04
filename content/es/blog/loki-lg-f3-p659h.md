---
title: "TWRP persistente en el LG Optimus F3 P659H: un perfil Loki nuevo"
date: 2026-11-04
description: "El P659H rechazaba TWRP con “boot certification verify”. Analicé su aboot, añadí un perfil Loki y conseguí un recovery persistente."
tags: [android, bootloader, lg, twrp, loki]
draft: false
---

El **LG Optimus F3 P659H** (`fx3sca`, firmware `P659h10a`) podía arrancar un recovery personalizado temporalmente, pero no aceptarlo en su partición. Al escribir TWRP directamente y pedir `adb reboot recovery`, el resultado era siempre el mismo: **“boot certification verify”**. El {{< g "bootloader" "bootloader" >}} de LG comprobaba la imagen instalada y la rechazaba antes de ejecutar su {{< g "kernel" "kernel" >}}.

La solución no fue modificar permanentemente `aboot`, sino añadir este modelo a **Loki**, el método clásico para aprovechar la forma en que algunos bootloaders LG antiguos cargan y verifican `boot` y `recovery`. El resultado fue **TWRP 3.1.1-0 persistente**: después de instalar la imagen parcheada, `adb reboot recovery` entra directamente a TWRP y Android continúa arrancando con su partición `boot` original.

## Primero había que encontrar Fastboot

El kernel publicado para la familia `fx3` confirmó que `reboot("bootloader")` escribe el motivo `0x77665500` en la memoria compartida de Qualcomm. El teléfono recibía ese motivo —el siguiente arranque mostraba `lge.r=77665500_20`—, pero aun así no presentaba {{< g "fastboot" "Fastboot" >}}. El análisis de `aboot` explicó por qué: LG había quitado la selección normal del modo Fastboot y solo dejaba su inicialización como salida de error cuando no podía cargar una imagen Android.

La prueba controlada consistió en cambiar temporalmente el primer byte de la magia de `boot`, de `ANDROID!` a `XNDROID!`. Con una imagen imposible de reconocer, `aboot` cayó a Fastboot (`18d1:d00d`, producto `FX3_SCA`). Desde allí fue posible probar TWRP con `fastboot boot` y restaurar inmediatamente el `boot.img` original. Esa prueba demostró dos cosas importantes: el kernel y el {{< g "ramdisk" "ramdisk" >}} de TWRP sí eran compatibles con el teléfono, y el fallo de la instalación permanente estaba exclusivamente en la ruta de certificación de LG.

## Por qué escribir TWRP no bastaba

La imagen TWRP sin modificar se escribió en `recovery` y se volvió a leer completa. Su hash coincidía, de modo que no había un error de escritura ni una partición equivocada. Aun así, `aboot` mostraba “boot certification verify”. El estado estándar `Device unlocked: true` de Fastboot tampoco anulaba esa verificación propietaria para una imagen instalada.

Loki resuelve este problema construyendo una imagen especial. Conserva el kernel y el ramdisk reales, pero hace que `aboot` cargue como ramdisk aparente una página que sobrescribe en RAM el comienzo de su propia función de verificación. El pequeño código colocado allí corrige después la cabecera activa para devolver al kernel las direcciones y tamaños verdaderos. El cambio existe solo durante ese arranque: la partición `aboot` permanece intacta.

El `loki_tool` original reconoció el patrón de código, pero terminó con `Unsupported aboot image`: no existía un perfil para el P659H. Había que obtener dos direcciones específicas de este binario:

```c
{
    .vendor = "Movistar/Latin America",
    .device = "LG Optimus F3 P659H",
    .build = "P659h10a",
    .check_sigs = 0x88f102e8,
    .hdr = 0x88f64aa8,
    .lg = 1,
},
```

`check_sigs` es la entrada de la rutina criptográfica que llama el flujo de *secure boot*. El patrón aparece en el archivo en `0x10310`; al corregir la cabecera de carga de `aboot`, su dirección de ejecución es `0x88f102e8`.

`hdr` fue la parte difícil. No es cualquier copia de la cabecera Android ni la dirección fija donde se hace una lectura inicial. Es la **cabecera activa** que el flujo común usa justo antes de verificar y arrancar la imagen. En el desensamblado del P659H, `aboot` carga explícitamente `r4 = 0x88f64aa8` y luego consulta:

```text
r4 + 0x08  tamaño del kernel
r4 + 0x0c  dirección del kernel
r4 + 0x10  tamaño del ramdisk
r4 + 0x14  dirección del ramdisk
```

Son exactamente los campos que el payload de Loki reescribe.

## Los fallos que encontraron la dirección correcta

Dos direcciones que parecían razonables produjeron una imagen que pasaba la certificación, pero no un recovery funcional. El teléfono ejecutaba el kernel de TWRP y cinco segundos después regresaba a Android. `/proc/last_kmsg` conservó la explicación:

```text
INITRD: 0x88f102e0+0x00000800 is not a memory region - disabling initrd
VFS: Cannot open root device "(null)" or unknown-block(0,0)
Kernel panic - not syncing: VFS: Unable to mount root fs
```

`0x88f102e0` era el ramdisk señuelo de Loki y `0x800` una sola página. El kernel arrancaba, pero el payload no había corregido la cabecera que realmente consumía el flujo final. Ese registro descartó problemas del kernel, del empaquetado de TWRP y de la tabla de particiones; obligó a seguir el valor de `r4` en el camino completo de `boot_linux_from_mmc`.

Con `hdr = 0x88f64aa8`, Loki restauró los valores reales:

```text
kernel  -> 0x80208000
ramdisk -> 0x82200000
```

TWRP apareció en pantalla y {{< g "adb" "ADB" >}} confirmó el entorno sin depender de la interfaz gráfica:

```text
/sbin/recovery
/sbin/twrp
ro.twrp.version=3.1.1-0
ro.build.product=fx3
```

La imagen instalada, `twrp_recovery_fx3_v4.lok`, mide 9,261,056 bytes dentro de una partición de 12,582,912 bytes. Antes de reiniciar se leyó nuevamente desde `mmcblk0p18` y se comparó byte por byte. Su SHA-256 es:

```text
c1ce4810d7ee78f64bda486b73fe42708e6a57e2dccb1879823d6fed9ac662dd
```

## Qué cambia y qué no

El teléfono tiene ahora un {{< g "recovery" "recovery" >}} TWRP modificado con Loki. No tiene un `aboot` reescrito: el desvío ocurre en RAM cada vez que se carga `recovery`. La copia del recovery original de LG se conservó y su hash completo se verificó antes de las pruebas.

Esto abre una vía segura para copias, restauraciones y desarrollo, pero no convierte cualquier ROM de otro Optimus F3 en compatible. Una ROM para este equipo todavía necesita su propio port para `fx3sca`, los blobs correctos y un `boot.img` que también pueda superar la verificación de LG —por ejemplo, parcheado con el perfil Loki del P659H—. TWRP era la puerta; portar CyanogenMod es el trabajo siguiente.

El kernel usado como referencia está publicado en [playfulgod/kernel_lge_fx3](https://github.com/playfulgod/kernel_lge_fx3). El antecedente que ayudó a separar este problema del caso Tegra está contado en [el desbloqueo del LG D625 con nvflash]({{< relref "nvflash-lg-d625.md" >}}).
