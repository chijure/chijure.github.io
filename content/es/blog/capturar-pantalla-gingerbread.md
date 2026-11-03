---
title: "Capturar pantalla en Android 2.3 sin screencap"
date: 2026-11-02
description: "Gingerbread no tiene screencap. La alternativa es leer /dev/graphics/fb0 directamente, y para eso hay que conocer el stride real del panel, que casi nunca coincide con el ancho de la pantalla."
tags: [android, gingerbread]
draft: false
---

`adb shell screencap` llegó en Android 4.0. En {{< g "gingerbread" >}} (2.3) no existe, así que para sacar una captura de pantalla de un teléfono viejo hay que leer el {{< g "framebuffer" >}} directamente: `/dev/graphics/fb0`.

La parte que falla casi siempre no es el permiso ni el formato, sino el **{{< g "bpp" >}} (stride)**: el ancho real, en píxeles, de cada fila de memoria, que casi nunca es igual al ancho visible de la pantalla. En el LG C660, la pantalla es de 240×320, pero el stride real es de **256 píxeles**, no 240. Si lees la imagen asumiendo 240, cada fila queda corrida y el resultado sale con rayas diagonales, como si el video estuviera descuadrado.

El stride se puede leer directamente del sistema, sin adivinar:

```
cat /sys/class/graphics/fb0/stride           # en bytes: 512
cat /sys/class/graphics/fb0/virtual_size     # 240,640
cat /sys/class/graphics/fb0/bits_per_pixel   # 16
```

Con 16 bits por píxel (RGB565, 2 bytes), 512 bytes de stride son 256 píxeles. El `virtual_size` de 640 de alto, el doble de los 320 visibles, es normal: el panel suele llevar doble búfer, así que el segundo medio del volcado es el otro cuadro.

Con esos tres números, volcar y convertir una captura es:

```sh
adb shell dd if=/dev/graphics/fb0 of=/data/local/tmp/fb.bin bs=4096 count=80
adb pull /data/local/tmp/fb.bin
```

```python
from PIL import Image
W, H = 256, 320            # stride real, no el ancho visible
d = open('fb.bin', 'rb').read()
px = bytearray()
for i in range(0, W * H * 2, 2):
    v = d[i] | d[i+1] << 8
    px += bytes(((v >> 11 & 31) * 255 // 31, (v >> 5 & 63) * 255 // 63, (v & 31) * 255 // 31))
Image.frombytes('RGB', (W, H), bytes(px)).crop((0, 0, 240, 320)).save('shot.png')
```

El recorte final (`crop`) es el que deja solo los 240 píxeles visibles, descartando los 16 de relleno del stride. Sin ese dato, no hay forma de adivinar correctamente el ancho real: cada fabricante y cada panel elige su propio redondeo (en este caso, a un múltiplo de 32 píxeles).
