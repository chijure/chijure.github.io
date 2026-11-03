---
title: "Qué no existe en la shell de Android 2.3 (y qué sí, contra lo que creía)"
date: 2026-11-02
description: "input tap, swipe y am force-stop no existen en Gingerbread. La aritmética $((...)) de la shell, en cambio, sí funciona: lo comprobé en un teléfono real después de haber dado por hecho lo contrario."
tags: [android, gingerbread]
draft: false
---

Depurar un teléfono con {{< g "gingerbread" >}} (Android 2.3) por `adb shell` tiene trampas que no existen en versiones más nuevas, y conviene conocerlas antes de escribir un script que se vaya a quedar colgado a mitad de una prueba.

## Lo que de verdad no existe

Comprobado en un LG C660 con CM7:

```
$ input tap 10 10
Error: Unknown command: tap

$ input swipe 10 10 20 20
Error: Unknown command: swipe

$ am force-stop com.ejemplo
Error: Unknown command: force-stop
```

`input` en esta versión solo acepta `text` y `keyevent`; para simular un toque hay que usar `sendevent` directamente sobre el dispositivo de entrada, o un `keyevent` si el elemento tiene foco. Para cerrar una app a la fuerza, sin `force-stop`, la alternativa es matar el proceso por `pid` (`ps` + `kill`) o usar `am kill`, que es más suave y no siempre libera la memoria.

## Una corrección a algo que yo mismo daba por hecho

Durante bastante tiempo asumí que la aritmética de la shell (`$((i+1))`) tampoco funcionaba en Gingerbread, porque en una sesión anterior un bucle con esa sintaxis se quedó colgado. Lo volví a probar hoy, directo en un C660 real, antes de publicar esto:

```sh
$ i=0; while [ $i -lt 3 ]; do i=$((i+1)); echo i=$i; done
i=1
i=2
i=3
```

Funciona perfectamente. El bucle colgado de aquella vez no era por la aritmética: era por el patrón del bucle completo (probablemente una condición que nunca se volvía falsa, o un comando que esperaba entrada). Lo correcto es decir que **no sé** qué lo colgó exactamente, no que `$((...))` esté roto. Queda como lección aparte: cuando algo falla, antes de generalizar la causa conviene aislar la pieza sospechosa y probarla sola, como hice recién.

## `cp` y `grep` existen, pero no donde esperas

`toolbox`, el conjunto de utilidades mínimas de Android, no trae `cp` ni `grep` en Gingerbread. Si tu ROM los tiene, es porque BusyBox los provee:

```sh
$ ls -l /system/bin/cp
ls: /system/bin/cp: No such file or directory
$ which cp
/system/xbin/cp
$ ls -l /system/xbin/cp
... -> busybox
```

La distinción importa cuando escribes un script que debe funcionar en cualquier Gingerbread, incluidos los que no traen BusyBox: en ese caso, `cp` y `grep` simplemente no están, y hay que usar `cat` y combinaciones de `toolbox` para lo mismo.

## `sleep` también depende de quién responda

En un teléfono con BusyBox, el comando que responde a `sleep` puede ser el de `toolbox` o el de BusyBox, según el orden del `PATH`, y **no son equivalentes**: el `sleep` de `toolbox` ignora la parte fraccionaria.

```sh
# toolbox sleep (seis llamadas a "sleep 0.5")
real    0m1.0s

# busybox sleep (las mismas seis llamadas)
real    0m3.0s
```

Si un script que mide tiempos con pausas cortas de fábrica da resultados que no cuadran, vale la pena comprobar primero cuál `sleep` está respondiendo (`which sleep`, o forzar `busybox sleep` directamente) antes de sospechar de la lógica del script.
