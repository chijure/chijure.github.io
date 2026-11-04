---
title: "Un parche, tres teléfonos: el bootloader LK de MediaTek"
date: 2026-10-17
description: "Un mismo parche al bootloader LK sirvió para tres LG, con ajustes. La primera versión parecía funcionar y dejaba el teléfono en bucle de arranque."
tags: [android, bootloader, mediatek]
draft: false
---

El [LG D625](https://github.com/chijure-android-system-development/lg-d625-tegra-bootloader-patch) (Tegra 4i) necesitó su propio camino de desbloqueo, con `nvflash`. Un grupo distinto de teléfonos LG más viejos —el **L5 II (E450g)**, el **L4 II (E440g)** y el **L50 (D213)**— comparten algo que lo hace distinto: el mismo bootloader **LK** de MediaTek, de la misma familia de chips (MT6575 y MT6572). Esa coincidencia es la que permitió que un solo trabajo de análisis sirviera, con ajustes, para los tres.

## El problema que resuelve

Un recovery personalizado como TWRP o CWM no viene firmado por LG. El LK, antes de arrancar cualquier imagen de la partición `boot` o `recovery`, verifica esa firma, y si no coincide, se detiene con un "Security Error" y no arranca nada. Sin esa verificación desactivada, no hay forma de instalar un recovery propio, salvo pagar por una herramienta de desbloqueo cada vez que haga falta.

## Lo que costó encontrar

El bootloader no publica su código fuente, así que el trabajo fue desensamblar el binario (`uboot_orig.bin`) hasta encontrar la función exacta que decide si el teléfono arranca. Esa función lee un valor guardado en memoria (el "tipo de seguridad" del equipo) y lo compara contra una máscara de bits que dice cuáles de esos tipos exigen una firma válida. En el E450g, el tipo que trae de fábrica sí la exige.

## Por qué la primera versión no servía

La solución obvia —saltarse esa función entera— se probó primero y pareció razonable, pero dejaba el teléfono en un **bucle de arranque infinito**. La razón no tenía nada que ver con la verificación de la firma en sí: esa misma función también inicializa un par de valores que otra parte del código, mucho más adelante en el arranque, necesita para ejecutar el kernel. Al saltarse la función completa, esos valores quedaban vacíos, el código que arranca el kernel los leía como inválidos, y el LK se reiniciaba solo.

La versión que sí funciona no se salta la función: la deja correr para que inicialice lo que necesita, y solo cambia el resultado de la comparación de la firma, para que el "Security Error" nunca se dispare. Es una diferencia de pocos bytes en el binario, pero entenderla exigió seguir el código más allá del punto donde aparentemente terminaba el problema.

## Resultado, verificado en los tres equipos

| Teléfono | Chip | Parches | Estado |
|---|---|---|---|
| LG L5 II (E450g) | MT6575 | 9, versión 7 | Verificado en hardware |
| LG L4 II (E440g) | MT6575 | 9, versión 1 | Verificado en hardware |
| LG L50 (D213) | MT6572 | 2 | Verificado en hardware |

El número de parches cambia entre modelos porque, aunque comparten la familia de bootloader, cada uno tiene su propio binario compilado, con la función de verificación en una dirección distinta y a veces con una lógica ligeramente diferente alrededor. El principio —encontrar la comparación de la firma y dejar que falle sin detener el arranque— es el mismo; el desplazamiento exacto de cada byte, no.

El análisis completo, con el desensamblado y el historial de versiones del parche, está publicado en [lg-e450g-lk-patch](https://github.com/chijure-android-system-development/lg-e450g-lk-patch), junto con los scripts que verifican el hash del binario original antes de parchearlo y el del resultado después.
