---
title: "adb por Wi-Fi, y por qué se pierde justo cuando más lo necesitas"
date: 2026-11-02
description: "adb tcpip permite depurar por Wi-Fi mientras el USB hace de host, pero depende de la red: un error mío muestra cómo se pierde la conexión."
tags: [android, adb]
draft: false
---

Cuando pruebo {{< g "otg" >}} en modo {{< g "host-mode" >}}, el puerto USB del teléfono deja de servir para {{< g "adb" >}}: está ocupado hablando con el pendrive o el ratón conectado. La solución es `adb` por Wi-Fi:

```sh
adb tcpip 5555
adb connect <ip-del-telefono>:5555
```

A partir de ahí, puedo desconectar el cable y seguir viendo el `dmesg` del teléfono mientras pruebo el modo host. Funciona bien, con una condición que es fácil de olvidar: **todo pasa por el Wi-Fi**, así que cualquier cosa que afecte al Wi-Fi afecta a la sesión de depuración.

## El error que acabo de cometer

Mientras preparaba este mismo texto, dejé el C660 en modo `tcpip` y, en el mismo lote de comandos, apagué su Wi-Fi para probar otra cosa:

```sh
$ adb tcpip 5555
restarting in TCP mode port: 5555
$ adb connect 192.168.1.11:5555
connected to 192.168.1.11:5555
$ adb shell 'svc wifi disable'
$ adb connect 192.168.1.11:5555
failed to connect to '192.168.1.11:5555': No route to host
```

En ese momento el teléfono quedó sin forma de recibir órdenes de adb: el puerto TCP no sirve sin Wi-Fi, y el teléfono seguía en modo `tcpip`, así que tampoco respondía por USB. La única salida fue volver a conectar el cable: `adb usb` seguido de reconectar el cable físicamente restablece el modo normal, porque el propio sistema detecta el cable y reinicia `adbd`.

## Lo que hay que recordar

- **`adb tcpip` cambia el modo del demonio `adbd`, no abre un segundo canal.** Mientras esté en modo TCP, el modo USB deja de responder, con cable conectado o no.
- **La propiedad que activa el puerto no sobrevive a un reinicio del teléfono.** Cada vez que el teléfono se reinicia (por una prueba de kernel, por ejemplo), hay que volver a hacer `adb tcpip 5555` desde una sesión por USB.
- **Nunca desactives el Wi-Fi mientras dependes del modo TCP para recuperar el control.** Si necesitas hacerlo, deja el cable USB conectado de antemano y pasa a `adb usb` justo antes.
- **El reinicio automático de `adbd`** también ocurre si usas `stop adbd; start adbd` por `shell` en vez de `adb usb`: a veces tarda unos segundos en volver a aparecer, así que conviene esperar y reintentar la conexión en vez de asumir que falló.

La lección de fondo no es evitar `adb` por Wi-Fi, que sigue siendo la única forma práctica de depurar un teléfono con el puerto USB ocupado en modo host. Es tratarlo como lo que es: una sesión que depende de una capa extra (el Wi-Fi), y que puede perderse por algo que no tiene nada que ver con `adb` en sí.
