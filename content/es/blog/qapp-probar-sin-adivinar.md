---
title: "QApp: probar una ROM sin adivinar"
date: 2026-11-02
description: "Nació para confirmar una batería gastada en el LG D625. Hoy es una app que corre un pase automático de pruebas en cualquier Android desde 2.2, con un informe que sobrevive a un reinicio del teléfono."
tags: [android, qapp]
draft: false
---

Portar una ROM a un teléfono viejo tiene un problema que no es de software: cuando algo falla, no siempre está claro si falla la ROM o el propio hardware, gastado por años de uso. **QApp** nació para sacar esa duda de en medio.

## El origen: una batería que ya no aguantaba

La primera versión se escribió para el LG D625, mientras investigaba un reinicio que parecía un bug de la ROM. La prueba de batería mide el voltaje en reposo, lo somete a una carga de CPU y GPU durante treinta segundos, y mide cuánto cae. Una batería sana cae poco y se recupera rápido; una gastada cae mucho y tarda en volver. Con esa medida pude descartar el kernel como causa y confirmar que la batería era la culpable, sin abrir el teléfono ni comprar una de repuesto para probar.

Esa misma prueba la volví a usar meses después en el [C660]({{< relref "usb-otg-c660.md" >}}), con una diferencia: ahora el resultado se guarda en un archivo mientras la prueba corre, no solo al final.

## Por qué el informe tiene que sobrevivir a un reinicio

La primera versión de la prueba de batería escribía su resultado solo cuando terminaba. Tiene sentido mientras el teléfono no se apague a mitad de la prueba, pero ahí está el problema: **si el teléfono se reinicia durante la prueba de estrés, que es exactamente el síntoma que estás intentando confirmar, no queda ningún registro de que la prueba se interrumpió, ni en qué punto.** El log más útil es justo el que nunca llega a escribirse.

Por eso `RunLog`, la clase que registra cada paso, ahora:

- Escribe una línea por cada muestra de voltaje, sincronizada a disco, no solo el resultado final.
- Marca en las preferencias del sistema que una prueba está "en curso" antes de empezarla, y borra esa marca solo cuando termina sin problemas.
- Si la app se abre y encuentra esa marca puesta, significa que la vez anterior el teléfono se apagó o se reinició a mitad de la prueba, y lo anota como una línea más del informe: `INTERRUPTED … uptime now Ns`. Un tiempo de actividad chico significa que el teléfono se reinició de verdad; uno grande, que solo se cerró la aplicación.

Esto aplica igual al pase automático de pruebas, al estrés de batería, a la prueba de reposo, a la de video y al de la GPU: los cinco escriben su progreso en vivo y se recuperan de un corte, no solo del final feliz.

## Lo que prueba, en orden

QApp instala desde Android 2.2 (API 8) hasta versiones actuales, protegiendo con comprobaciones de versión cada API que no existía en los teléfonos más viejos. El pase automático recorre, sin ayuda:

- **Básico:** sonido, vibración, táctil, pantalla y píxeles muertos, sensores, multitáctil, botones físicos y virtuales, información del equipo, batería y almacenamiento.
- **Conectividad:** Wi-Fi (con una prueba de estabilidad de la conexión durante dos minutos), Bluetooth, GPS, NFC.
- **Multimedia:** cámara y flash, micrófono, OpenGL y un *benchmark* de GPU, reproducción de video con clips incluidos en H.264 y MPEG-4 que comprueban si la imagen sigue el ritmo real, y datos de la grabación propia.
- **Telefonía:** SIM, señal, marcador y accesos directos de SMS.

Cada resultado queda como PASS, FAIL, N/A (si el hardware no existe en ese modelo) o MANUAL (cuando necesita que la persona confirme algo, como un sonido o un color). El informe se puede guardar, compartir y comparar contra el de otra ROM o de otra compilación del mismo teléfono, lo cual es la otra mitad del problema: no basta con saber que algo falla hoy, hace falta saber si fallaba antes del cambio que acabas de hacer.

## Una herramienta que crece con los problemas reales

Ninguna de las pruebas salió de una lista general de "cosas que probar en Android". Cada una nació de un bug concreto: el *benchmark* de GPU, de necesitar un número para decir si una ROM es más fluida que otra; la prueba de estabilidad de Wi-Fi, de un router que soltaba la conexión cada pocos minutos; la de reposo, de confirmar que el teléfono realmente duerme con la pantalla apagada y no gasta la batería despierto sin motivo.

Es software, así que no reemplaza una medición con instrumentos (un multímetro en la batería, por ejemplo), pero reemplaza algo peor: la costumbre de adivinar.

El código es público, en [romtester](https://github.com/chijure/romtester).
