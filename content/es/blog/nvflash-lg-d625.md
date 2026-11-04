---
title: "El LG G2 Mini no usa LK: desbloquear un Tegra 4i con nvflash"
date: 2026-11-03
description: "El G2 Mini (D625) es un Tegra 4i, no MediaTek con LK: el desbloqueo es otro, con su propio modo de recuperación y su propia herramienta de grabado."
tags: [android, bootloader, tegra, e400]
draft: false
---

El [L5 II, el L4 II y el L50]({{< relref "parche-lk-mediatek.md" >}}) comparten el bootloader {{< g "lk" "LK" >}} de MediaTek, así que un mismo método de análisis sirvió, con ajustes, para los tres. El **LG G2 Mini (D625)** es otra familia por dentro: un **NVIDIA Tegra 4i**, con su propio modo de recuperación de bajo nivel y su propia herramienta de grabado. Nada de lo aprendido con el LK se podía reutilizar tal cual.

## Un chip que arranca "vacío"

Los procesadores Tegra tienen un modo llamado {{< g "apx" "APX" >}}: se entra sosteniendo las teclas de volumen al conectar el USB, y el chip arranca sin ningún firmware propio, esperando que algo se lo suba por USB. Es un diseño distinto al de un bootloader LK que ya está grabado en la flash y decide por sí solo si arranca o no: aquí primero hay que darle al chip un programa pequeño en RAM (el "servidor") para que pueda hacer cualquier otra cosa, incluida leer su propia tabla de particiones.

Ese servidor no tiene por qué ser del mismo teléfono: uno de otro equipo con el mismo Tegra 4i, el Wiko Wax, sirvió para iniciar la conversación con el D625 y leer su configuración real, aunque sus números de partición no coinciden (en el D625, el bootloader está en la partición 5 y el recovery en la 16; copiar los números del Wiko a ciegas habría escrito en el lugar equivocado).

## Por qué no alcanza con escribir los bytes

Con el LK de MediaTek, el método fue encontrar la comparación de firma en el binario y cambiar su resultado. Con el Tegra, ese mismo tipo de parche binario sigue siendo necesario —hay que localizar la verificación de firma y alterar su resultado para que un recovery sin firmar pase—, pero instalarlo no es tan simple como escribir el archivo parcheado en la partición. El Tegra guarda, en una tabla aparte ({{< g "bct" "BCT" >}}), metadatos de integridad del bootloader que también hay que actualizar; escribir solo los bytes del binario sin tocar esa tabla deja al chip en un estado inconsistente que puede hacerlo caer a una etapa de respaldo o directamente no arrancar.

La herramienta oficial de NVIDIA, {{< g "nvflash" "nvflash" >}}, hace las dos cosas juntas: graba la partición y actualiza el hash y la firma del BCT en el mismo paso. Por eso el flujo verificado para el D625 usa siempre `nvflash --download … --sync`, nunca una escritura directa de sectores ni una edición manual del BCT.

## Lo que se mantiene intacto a propósito

Un detalle que marcó la diferencia con el LK: el Tegra tiene una segunda etapa de arranque ({{< g "rbl" "RBL" >}}) separada de la que se parchea ({{< g "ebt" "EBT" >}}), pensada como red de seguridad si la primera falla. El método verificado instala el EBT parcheado pero deja el RBL original sin tocar, así que si algo sale mal con el parche, el chip todavía tiene una vía de recuperación. Es la misma lógica de "no apostarlo todo a una sola partición" que ya había aparecido con el recovery como primer paso en otros equipos de esta serie.

## Resultado

Con el EBT parcheado, el mismo equipo pasó de arrancar solo una imagen de prueba con la firma alterada a arrancar imágenes propias: TWRP instalado como recovery permanente, y un kernel compilado desde la fuente publicada corriendo en la partición de arranque. `fastboot getvar unlocked` responde `yes`.

El análisis completo —el formato del BCT, los números de partición de este equipo en particular, y los pasos de verificación por lectura antes y después de escribir— está en [lg-d625-tegra-bootloader-patch](https://github.com/chijure-android-system-development/lg-d625-tegra-bootloader-patch).
