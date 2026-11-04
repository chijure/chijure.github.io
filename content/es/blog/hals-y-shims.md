---
title: "Parches de plataforma o device tree: por qué elijo HALs y shims"
date: 2026-10-22
description: "Mi regla en los ports: no parchear la plataforma de Android y resolver el hardware en el árbol del dispositivo con HALs y shims. Tres ejemplos."
tags: [android, device-tree]
draft: false
---

Si miras los árboles de dispositivo que he publicado, vas a encontrar la misma frase repetida: *"todo por {{< g "device-tree" >}} HAL, como en el Y220"*. No es una regla abstracta, es una decisión que tomo en cada port y que me ha costado deshacer cuando no la seguí. Esto es lo que significa y por qué la prefiero.

## El problema de parchar la plataforma

Un árbol de {{< g "cm" >}} comparte `frameworks/base`, `system/core` y el resto de la plataforma entre **todos** los teléfonos que compilo en el mismo árbol. Si arreglo algo del Y210 metiendo mano directamente en `frameworks/base`, ese cambio viaja también al build del Y220 y del C660, aunque no les haga falta o, peor, aunque les rompa algo.

Ya me pasó: un parche de cámara de un teléfono quedó sin querer mezclado en el parche de Bluetooth de otro, y una compilación limpia fallaba porque `apply-patches.sh` intentaba aplicar un fragmento que no le correspondía. La regla que terminé escribiendo es simple: **los cambios de plataforma, si son inevitables, viven como archivos `.patch` dentro del árbol del dispositivo** (`device/<fabricante>/<modelo>/patches/`), con un script que los aplica y otro que los revierte, nunca como un commit suelto en el repositorio de la plataforma.

Pero el objetivo de fondo es necesitar el menos posible de esos parches, y para eso sirven las {{< g "hal" >}} y los *shims*.

## Ejemplo 1: un `LD_PRELOAD` en vez de tocar bionic

El Y220 (MediaTek MT6572) usa blobs de video de fábrica que esperan símbolos que la bionic de {{< g "cm" >}} no tiene: un par de syscalls de afinidad de CPU, el identificador de hilo de pthread, y una clase de memoria compartida (`MemoryHeapBaseMTK`) que en el binario de fábrica es solo un envoltorio sobre la clase estándar de Android.

La solución que descarté fue parchar la bionic del árbol, porque eso sí afecta a todos los teléfonos. En su lugar, escribí una librería pequeña, `libmtk_shim`, que define esos símbolos, y la precargo solo en el proceso que los necesita:

```
setenv LD_PRELOAD libmtk_shim.so
```

en el servicio `media` de `init.rc`. El *linker* de Gingerbread busca primero en las librerías precargadas, así que los blobs de video encuentran los símbolos sin que bionic ni ningún otro proceso del sistema se entere. Es exactamente el mismo mecanismo con el que depuras funciones de una librería en Linux, aplicado a resolver un hueco de compatibilidad binaria.

## Ejemplo 2: puentes para un stack de Bluetooth que no es BlueZ

El kernel del Y220 no tiene sockets Bluetooth (`AF_BLUETOOTH` apagado): el stack de fábrica es `mtkbt`, de MediaTek, que habla con el teléfono por sockets de datagrama propios, no por BlueZ. Todo el código de Bluetooth de CM7 asume BlueZ.

La alternativa fácil hubiera sido portar BlueZ entero, activar el socket en el kernel, y usar el código de CM7 tal cual. La descarté por dos razones: BlueZ requiere activar y probar una pila completa nueva, y el stack de fábrica ya está probado por el fabricante contra ese hardware exacto. En vez de eso, escribí **puentes chicos**, uno por función: uno traduce las llamadas de la API de Android (encender, buscar, emparejar) a los mensajes de `mtkbt`; otro hace lo mismo para el envío y recepción de archivos por OPP; otro para A2DP. Cada puente es una librería de unas pocas funciones, con un parche mínimo a `frameworks/base` solo donde la API de Android no deja otra entrada.

El resultado funciona igual para quien usa el teléfono, pero la superficie de parche a la plataforma es mínima y queda documentada archivo por archivo.

## Ejemplo 3: cargar una clase de RIL por nombre, no por rama paralela

Varios de mis árboles comparten el mismo `PhoneFactory.java` de la plataforma, y cada teléfono necesita una implementación distinta del RIL (la interfaz con el módem). La tentación es bifurcar `PhoneFactory` por teléfono, pero eso vuelve a mezclar plataforma con dispositivo.

El parche real es mínimo:

```java
} else if ("mediatek".equals(sRILClassname)) {
    // MediaTekRIL viene del device tree, así que se carga por nombre;
    // los árboles que no lo traen siguen compilando igual.
    Log.i(LOG_TAG, "Using MediaTek RIL");
    sCommandsInterface = new MediaTekRIL(context, networkMode, cdmaSubscription);
```

La clase `MediaTekRIL` en sí vive en el árbol del dispositivo, no en la plataforma. El parche a `PhoneFactory` es la única línea que toca el árbol compartido, y es inofensiva para cualquier otro teléfono: si su device tree no define `sRILClassname=mediatek`, esa rama del `if` nunca se ejecuta.

## El experimento que confirmó la regla

No siempre funciona a la primera. En el [C660]({{< relref "usb-otg-c660.md" >}}) probé un *shim* de RIL para resolver un estado de SIM mal reportado, interceptando las llamadas entre el blob de fábrica y la plataforma. Fallé: el shim rompía la máquina de estados del radio ("`Unrecognized RIL_RadioState: 3`"), y lo descarté. La solución final fue, otra vez, un parche de una línea a la clase de la plataforma que ya existía (`QualcommNoSimReadyRIL`), justificado y documentado como los demás.

El shim no era la herramienta equivocada en general: era la herramienta equivocada para ese problema concreto, porque el fallo estaba en cómo la plataforma interpreta un estado, no en un símbolo o una API que faltara reemplazar.

## La regla, resumida

1. Si el problema es que falta un símbolo o una función en tiempo de ejecución, un `LD_PRELOAD` o una librería compartida chica, con alcance al proceso que la necesita.
2. Si el problema es que el hardware habla un protocolo distinto al que la plataforma espera, un puente de traducción, función por función, no un port completo de la pila alternativa.
3. Si de verdad hace falta tocar la plataforma, que sea la menor cantidad de líneas posible, cargada por nombre o por una condición del device tree, y guardada como parche versionado en el árbol del dispositivo.
4. Antes de escribir el puente, comprobar que el problema es realmente de compatibilidad binaria o de protocolo, y no de lógica de la plataforma. Un shim no arregla una lógica equivocada.
