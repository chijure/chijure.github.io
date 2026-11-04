---
title: "Screenshotting Android 2.3 without screencap"
date: 2026-11-02
description: "Gingerbread has no screencap. Read /dev/graphics/fb0 directly and use the panel's real stride, which almost never matches the visible width."
tags: [android, gingerbread]
draft: false
slug: gingerbread-screen-capture
aliases: [/blog/capturar-pantalla-gingerbread/]
---

`adb shell screencap` arrived in Android 4.0. On {{< g "gingerbread" >}} (2.3) it doesn't exist, so taking a screenshot of an old phone means reading the {{< g "framebuffer" >}} directly: `/dev/graphics/fb0`.

The part that almost always trips you up isn't the permission or the format, it's the **{{< g "bpp" >}} (stride)**: the real width, in pixels, of each row in memory, which almost never equals the screen's visible width. On the LG C660, the screen is 240×320, but the real stride is **256 pixels**, not 240. If you read the image assuming 240, every row comes out shifted, and the result looks like diagonal tearing, as if the video were out of sync.

The stride can be read straight from the system, no guessing needed:

```
cat /sys/class/graphics/fb0/stride           # in bytes: 512
cat /sys/class/graphics/fb0/virtual_size     # 240,640
cat /sys/class/graphics/fb0/bits_per_pixel   # 16
```

At 16 bits per pixel (RGB565, 2 bytes), a 512-byte stride is 256 pixels. The `virtual_size` height of 640, twice the visible 320, is normal: the panel usually has double buffering, so the second half of the dump is the other frame.

With those three numbers, dumping and converting a screenshot looks like this:

```sh
adb shell dd if=/dev/graphics/fb0 of=/data/local/tmp/fb.bin bs=4096 count=80
adb pull /data/local/tmp/fb.bin
```

```python
from PIL import Image
W, H = 256, 320            # real stride, not the visible width
d = open('fb.bin', 'rb').read()
px = bytearray()
for i in range(0, W * H * 2, 2):
    v = d[i] | d[i+1] << 8
    px += bytes(((v >> 11 & 31) * 255 // 31, (v >> 5 & 63) * 255 // 63, (v & 31) * 255 // 31))
Image.frombytes('RGB', (W, H), bytes(px)).crop((0, 0, 240, 320)).save('shot.png')
```

The final crop keeps only the 240 visible pixels, dropping the 16 pixels of stride padding. Without that figure there's no way to guess the real width correctly: every vendor and every panel picks its own rounding (here, to a multiple of 32 pixels).
