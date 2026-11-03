---
title: "La batería del C660: qué se puede medir sin fuel gauge"
date: 2026-11-02
description: "El LG C660 no tiene un chip medidor de batería: todo el voltaje viene filtrado por RPC desde el módem, en saltos de 17 mV. Esto es lo que se puede concluir con esa limitación, y lo que no."
tags: [android, battery, c660]
draft: false
---

Cuando sospechas de una batería gastada, lo ideal es un multímetro. Lo que tenía a mano era el LG C660 y [QApp]({{< relref "qapp-probar-sin-adivinar.md" >}}), así que esto es hasta dónde se puede llegar con software, y dónde hay que parar.

## El teléfono no tiene {{< g "pmic" >}} con medidor de celda

El C660 no trae un chip dedicado a medir la batería (ni `bq27x00` ni `max17040`, los dos están apagados en el kernel). Todo lo que ve Android —voltaje, capacidad, temperatura— llega por una llamada remota al módem (`msm_battery` por RPC), que a su vez filtra la señal del ADC. La consecuencia práctica: el voltaje se mueve en **saltos de unos 17 mV**, no en una curva continua, y hay que tenerlo en cuenta al interpretar cualquier número.

## Tres pruebas, tres resultados distintos

El estrés de batería mide el voltaje en reposo, lo somete a 30 segundos de carga de CPU y GPU, y mide cuánto cae y qué tan rápido se recupera.

| Prueba | Reposo | Mínimo bajo carga | Caída | Recuperado | Veredicto |
|---|---|---|---|---|---|
| 1 | 4.227 mV | 3.882 mV | 345 mV | 4.174 mV | AGING |
| 2 (se reinició a los 8 s de carga) | 4.141 mV | 3.779 mV* | — | — | interrumpida |
| 3 | 4.364 mV | 4.038 mV | 326 mV | 4.296 mV | AGING |

*Último valor guardado antes del reinicio, no el mínimo real de esa corrida.

Tres corridas, tres lecturas de reposo distintas (4.227, 4.141 y 4.364 mV) con la batería supuestamente en el mismo estado. Ese solo hecho dice que ninguna lectura aislada alcanza para un diagnóstico.

## Por qué el "reposo" miente un poco

El reposo se mide justo al desenchufar el cargador. En la prueba 3, el voltaje llegó a **4.382 mV durante unos segundos**, por encima del máximo de diseño del fabricante (4.300 mV). Eso es carga superficial: la tensión que se acumula en la superficie de la celda mientras carga y que se disipa sola en los primeros segundos sin corriente. Si uso en cambio el voltaje de **recuperación** (el que se estabiliza después de la carga de la prueba, no antes) como referencia, la caída de la prueba 3 queda en unos 258 mV, no 326, y eso cambia el veredicto de "AGING" a "GOOD" según el mismo umbral del programa (caída ≤ 300 mV con mínimo ≥ 3.650 mV).

No es un bug de la prueba: es que "voltaje en reposo" es ambiguo cuando se mide a los pocos segundos de desconectar el cargador.

## El dato que sí pesa: un reinicio real

La prueba 2 es la única que aporta algo que no depende de interpretación: el teléfono **se reinició solo a los 8 segundos** de empezar la fase de carga de la prueba, con el voltaje cayendo de 4.141 a 3.779 mV en ese tramo. Un reinicio bajo carga de CPU es compatible con una celda que no sostiene la corriente pico, pero una sola ocurrencia, sin poder repetirla, no es una prueba: podría ser la batería, podría ser otra cosa que coincidió justo esa vez.

## Lo que esto deja

- **Sin fuel gauge, cada lectura aislada de voltaje es poco confiable.** Hace falta repetir la prueba varias veces y en distintos momentos (después de cargar, después de un rato de reposo) antes de confiar en un número.
- **El voltaje de recuperación es mejor referencia que el de reposo inmediato**, porque no arrastra la carga superficial.
- **Un solo reinicio bajo carga es una pista, no una conclusión.** Para confirmar una batería realmente gastada, en un teléfono sin fuel gauge, la alternativa honesta sigue siendo un multímetro o, en última instancia, probar con otra batería.

No concluyo que la batería de este C660 esté mala. Concluyo que, con las herramientas que tenía, no puedo decir que lo esté con la confianza que haría falta para recomendar cambiarla.
