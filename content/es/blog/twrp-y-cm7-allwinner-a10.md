---
title: "Un TWRP y un CM7 para una tablet Allwinner A10, con GPU y sensores"
date: 2026-11-10
description: "BRONCHO PAD703 (Allwinner A10): TWRP y CyanogenMod 7 con GPU, Wi-Fi, audio, cámara y vídeo. Qué falló, cómo se midió y un reloj de 22 ms."
tags: [android, allwinner, a10, twrp, cm7, gingerbread]
draft: false
---

La **BRONCHO PAD703** es una tablet de 7 pulgadas con un Allwinner **A10** (familia `sun4i`, Cortex-A8, GPU Mali-400), pantalla de 800×480 y un Android 4.0.3 de fábrica. El `MemTotal` marca unos 306 MB aunque la placa tiene 512. Entra con adb como root, y eso lo cambió todo: pude **medir** casi cada cosa en lugar de suponerla. Este artículo cuenta el camino hasta un TWRP y un CyanogenMod 7 ({{< g "gingerbread" "Gingerbread" >}}) que arrancan en ella, con GPU, Wi-Fi, audio y cámara, y con lo que aún no funciona.

## Mapa de la NAND y respaldo primero

La {{< g "nand" "NAND" >}} se parte en `nanda` a `nandj`: `nanda` es una FAT de 16 MB con `script.bin` y U-Boot, `nandb` el entorno de U-Boot, `nandc` el `boot`, `nandd` el `system` (256 MB), `nande` el `data`, `nandf` el `misc`, `nandg` el `recovery`, `nandh` la caché, `nandi` un `/oem` y `nandj` el almacenamiento de usuario. Antes de grabar nada copié `nanda`, `nandb`, `nandc`, `nandf` y `nandg` al PC, con `sha256` de cada una.

Una trampa de método: el adb de Android 4.0 no soporta `exec-out`, así que cada partición se copia primero al almacenamiento de usuario (`nandj`, no a las particiones del sistema) y se baja con `adb pull`.

## El TWRP: un kernel que ya servía

El `boot` y el `recovery` de fábrica llevan **el mismo** `zImage` (Linux 3.0.8). Lo reutilicé tal cual y con `--base 0x40000000` el `mkbootimg` normal reproduce la cabecera original, sin herramientas especiales. Lo demás fueron detalles medidos:

- **Táctil.** El `ft5x_ts` es un módulo `.ko` que Android carga desde `/system`. Un recovery no tiene `/system`, así que va dentro del ramdisk.
- **Color.** `fb0` es de 800×480, 32 bpp, y `BGRA_8888` acertó a la primera.
- **Brillo.** No hay `/sys/class/backlight`. Desensamblé `lights.sun4i.so` de Android y vi que hace un `ioctl` `0x142` al nodo `/dev/disp` con `{0, brillo, 0, 0}` (el `DISP_CMD_LCD_SET_BRIGHTNESS` del kernel de Allwinner). Parcheé TWRP para usarlo cuando el dispositivo lo pide, y el control de brillo funciona.
- **Reiniciar a recovery.** Aquí U-Boot **ignora** el argumento de `reboot()`: ni `adb reboot recovery` ni el menú de TWRP entraban. Solo mira la partición `misc`. Hay que escribir el {{< g "bcb" "mensaje de arranque" >}} (`boot-recovery` en el desplazamiento 0 y `recovery\n` en el 64, 1088 bytes) antes de reiniciar. TWRP ejecuta `/sbin/rebootrecovery.sh` si existe, y ahí se escribe. Funciona, y TWRP borra el mensaje al arrancar para que no haya bucle.
- **Con botones.** El `script.bin` dice `[recovery_key] key_min=8 key_max=20`. Leyendo el registro del ADC del teclado (`0x01C2280C`) mientras pulsaba, **volumen + da 18** (dentro del rango) y volumen − da 24–25 (rango de modo de fábrica, 21–30). Con la tablet apagada: volumen + y encendido. Lo confirmé arrancando.

Un backup y un restore de TWRP probados de verdad: `boot` y `cache` se restauran con el `sha256` de `nandc` idéntico al original, y el `system` restaurado volvió a arrancar el Android de fábrica.

## El CM7: lo que fue fallando, en orden

El árbol de dispositivo (`device/allwinner/a10`) usa el kernel de fábrica y los blobs del stock. Compila a la primera, pero **no arrancaba**, y cada capa tuvo una causa distinta que se pudo demostrar:

1. **SurfaceFlinger caía en bucle.** `libUMP.so` del Android 4.0 importa `__popcount_tab`, un símbolo que el libc de ICS exporta y el de Gingerbread no. Lo peor: `libui` de Gingerbread sí lo tiene, pero el enlazador de Gingerbread **solo busca en las dependencias directas** de cada librería, y `libUMP` no depende de `libui`. Lo aporto desde `libcutils`, que sí es dependencia directa, con una tabla de 256 bytes que comprobé idéntica, byte a byte, a la de ICS.
2. **Datos de ICS en `/data`.** El proveedor de contactos encontraba una base de datos de versión 625 y no podía bajar a la 353. Hay que borrar `data` al cambiar de Android (hice antes un backup verificado).
3. **Memoria de Dalvik.** Sin `dalvik.vm.heapsize` el límite era de 16 MB y `system_server` moría decodificando el fondo de pantalla.
4. **`SystemUI` en bucle de caídas.** El código buscaba un recurso con un identificador y el APK lo tenía en otro: la caché de `out/target/common` se comparte entre dispositivos y quedaron clases de otra compilación. Borrar esos intermedios lo arregló. Lo detecté porque comparé los identificadores con `aapt` en vez de fiarme de "compila sin errores".
5. **La GPU.** Fue el trabajo más largo, y tuvo dos etapas. Primero la hice arrancar con las librerías del Android de fábrica (ICS, Mali r2p4), que son las que casan con el driver del kernel de la tablet. En este Gingerbread, `egl.cfg` es `0 0 android` (software) y `0 1 mali` (hardware), y SurfaceFlinger pasó de *Android PixelFlinger* a **Mali-400 MP, OpenGL ES 1.1**. Funcionaba, pero a **25 FPS** con la CPU saturada. Cómo lo arreglé está en la sección «Los 25 FPS».
6. **CheckJNI.** Compilar `eng` lo activa y frena Dalvik. La variante `userdebug` falla en ProGuard con una app ajena, así que lo apago con `dalvik.vm.checkjni=false`, que `AndroidRuntime` prioriza.

## Sensores: el chip no era el que decía el stock

El Android original cargaba tres drivers de acelerómetro y el de `dmard06` registraba un dispositivo de entrada. Pero al leer el bus I²C directamente, en la dirección del DMARD06 (`0x1c`) **no responde nada**; en `0x4c` responde un acelerómetro con el mapa de registros exacto de un **MMA7660**. Con `mma7660.ko` cargado antes de `system_server` y el HAL del stock, el giro de pantalla funciona (tarda un poco, algo normal en Gingerbread). Un detalle que me costó un reinicio: tras un `rmmod` de ese módulo, con el sensor en uso, la tablet se reinició sola. No lo demostré, pero **no lo descargo en caliente**.

## Sin Bluetooth, sin SIM: lo que sobra

El `script.bin` dice `bt_used = 0` y el Wi-Fi es un Realtek por USB, no un combo. Leyendo el código vi que Android solo quita el interruptor de Bluetooth de Ajustes cuando no hay servicio, pero **deja el apartado** "Ajustes de Bluetooth". Hice un parche pequeño en `SystemServer` y en Ajustes, desactivado por defecto para no tocar otros dispositivos. Comprobé que el servicio ya no existe en el arranque, pero **no he mirado la pantalla de Ajustes**. Las apps `Mms`, `VoiceDialer` y `Bluetooth` son opcionales y no se pueden quitar con `filter-out`, porque `inherit-product` resuelve las listas después: hay que usar una base propia que no las incluya. Con `Contacts` pasa igual, y además trae los iconos «Teléfono» y «Contactos»: como viene en `core.mk`, copié esa lista sin él. Dejé `Phone.apk` (el servicio de telefonía, sin icono), porque quitarlo puede romper `TelephonyManager`. Y los botones Inicio, Menú y Atrás aparecen en la barra de estado gracias a la función "Tablet tweaks" que CM7 ya trae (se activa con tres recursos).

## Wi-Fi: cuatro fallos encadenados

En CM7 el módulo Realtek `8192cu` cargaba pero el dongle USB nunca se enumeraba. Una prueba A/B con el Android original demostró que el hardware iba bien: el fallo era mío. Salieron **cuatro causas seguidas**, cada una escondida detrás de la anterior:

1. **`usb_wifi` quiere texto, no un número.** `libhardware_legacy.so` del stock escribe en `/sys/class/usb_wifi/rtl_wifi/usb_wifi` antes del `insmod`. Mi parche escribía `1` y no pasaba nada. Desensamblando `rtl_usb_wifi_store` del kernel vi que compara la cadena con **`on`** y **`off`**; con `1` ignora la escritura. Con `on`, el dongle se enumera y aparece `wlan0`.
2. **El socket de `wpa_supplicant`.** El cliente de Gingerbread busca el socket en `/data/system/wpa_supplicant`, no por nombre. Hay que quitar la línea `socket wpa_wlan0` del servicio y usar `ctrl_interface=DIR=/data/system/wpa_supplicant GROUP=wifi`.
3. **Orden del `init`.** El `.rc` del dispositivo se importa **antes** que el `init.rc` genérico, así que en `post-fs-data` aún no existe `/data/misc`. Los `mkdir` de `/data/misc/wifi/sockets` y `/data/misc/dhcp` fallaban en silencio y el cliente no podía hacer `bind` ni `dhcpcd` guardar su archivo. Se mueven a `on boot`.
4. **Mi propio parche de Bluetooth.** Al conectar, `WifiStateTracker` consulta un servicio A2DP que yo había eliminado, y el `NullPointerException` tumbaba `system_server` en bucle de arranque. Se arregla capturándolo, y para salir del bucle edité `wifi_on=0` en `settings.db` desde el PC.

Resultado: WPA2, DHCP y salida a internet, y se reconecta sola tras reiniciar.

Con la ROM ya «estable» aparecieron **dos fallos más**, de esos que solo salen con el uso real:

- **`off` nunca se escribía.** El `on` de `usb_wifi` alimenta el dongle y toma el *wake-lock* `rtl_usb_wifi`; solo `off` lo suelta. Mi parche no lo escribía jamás, así que **con el Wi-Fi apagado la CPU seguía despierta**. Lo comprobé en vivo: `echo off > usb_wifi` liberaba el lock. La corrección es escribir `off` al descargar el driver. Con el Wi-Fi encendido el lock sigue ahí por diseño del driver, y la CPU no baja de 1,2 GHz: es un tema de batería, no de estabilidad.
- **El primer arranque tras un borrado de datos.** `/data/system` lo crea `system_server` después, así que el `mkdir /data/system/wpa_supplicant` del `init` falla y `wpa_supplicant`, que corre como usuario `wifi`, no puede crear su socket de control: el Wi-Fi no escanea. Solo ocurre tras un `wipe`; a partir del segundo arranque el directorio ya existe, y por eso no lo había visto. Se arregla creando `/data/system` antes.

## Audio, cámara y microSD

**Audio.** El kernel ya expone ALSA (`sun4i-CODEC` y HDMI), así que basta el HAL genérico de CM7 (`hardware/alsa_sound` con `alsa-lib`). Tuve que borrar los objetos de `libaudioflinger`, porque `make` no rastrea las banderas del compilador. Aun así no sonaba: el códec arranca con `Playback Switch` apagado y `DAC Switch` en `MUTE`. Un script de arranque los activa y sube `Master Playback Volume` a 63 (a 50 se oía muy bajito; cada paso son ~1 dB).

**Cámara.** Solo hay un sensor VGA frontal (`gc0308`). El `camera.exDroid.so` de stock es un módulo de ICS y no sirve en Gingerbread, así que escribí un `libcamera` propio sobre V4L2 (`/dev/video0`). Lo que costó:
- Mi cliente de prueba compilado con una glibc moderna usaba una `struct v4l2_buffer` de **80 bytes** (`time64`) y el kernel espera **68**: `QUERYBUF` fallaba con `EINVAL`.
- El driver exige 3 buffers y una sola apertura, y rechaza `S_PARM`, que el HAL de stock tampoco usa.
- La GPU Mali no pinta NV21 (`format 17 not supported by the GL`). El HAL sirve RGB565 y un parche en `CameraService`, desactivado por defecto, toma el formato de `preview-format` en lugar del fijo.
- El visor iba a saltos: convertir tardaba **103 ms** por fotograma porque el buffer mmap de V4L2 es memoria no cacheada. Copiarlo antes con `memcpy` lo bajó a ~14 ms.
- Un interbloqueo: los callbacks de `CameraService` toman el cerrojo del cliente, que ya tiene retenido `takePicture`. Y un detalle del `Thread` de Android: **muere sin avisar si sueltas su última referencia fuerte**, dejando `/dev/video0` ocupado.
- La app Cámara de CM7 asume `degrees = 90` (móvil vertical). En una tablet naturalmente apaisada eso gira la vista previa; el parche usa 0 cuando la pantalla es apaisada de fábrica.

**EXIF.** El Android de fábrica guarda cada foto con `Orientation`, fabricante, modelo y distancia focal; las mías salían sin nada, así que una foto en vertical aparecía acostada. El HAL escribe ahora un bloque EXIF mínimo (orientación según la rotación que pide la app, fecha, `BRONCHO`/`PAD703`, 3,43 mm).

**Vídeo.** Gingerbread trae sus codificadores de software dentro de `libstagefright` (AVC, MPEG-4, AAC), así que el trabajo está en el HAL y en un `media_profiles.xml` propio. El HAL entrega fotogramas YUV420SP con marca de tiempo y espera a que la app los devuelva; esos buffers llegan como *proxies* de binder, así que se identifican por su posición en el *heap*, no por puntero. Resultado medido en la tablet, a 640×480:

| Códec | fps reales | Fábrica (ICS) |
| --- | --- | --- |
| MPEG-4 + AAC | **13,2** | 14,35 (H.264) |
| H.264 + AAC | 5,8 | |

El H.264 de software no da más de un solo núcleo (no sé con qué codificador graba el de fábrica; quizá el de hardware de Allwinner), así que la calidad «alta» usa MPEG-4. El audio AAC trae señal real (nivel medio −31,8 dB). El AMR a 8 kHz sale roto: el HAL de captura ignora la frecuencia pedida y graba a 44,1 kHz, así que ambas calidades usan AAC. Un detalle de infraestructura: los perfiles los guarda Android en una variable estática heredada de `zygote`, por lo que un `media_profiles.xml` nuevo no se nota hasta reiniciar.

**microSD.** Es FAT32 sin tabla de particiones (`mmcblk0`). Faltaba el punto de montaje (`/mnt` se crea en `on init`, después de `early-init`) y Gingerbread solo monta solo el volumen primario, así que un servicio de arranque la monta con `vdc`.

**Reiniciar → Recovery.** Funciona desde el menú de CM7. Fallaba porque `/dev/block/nandf` era `root:root 0660` y la escritura del BCB, que corre en `system_server`, fallaba en silencio; se arregla con un `chown` en el `init`.

## Los 25 FPS: un reloj que tardaba 22 ms

Con un test de OpenGL que dibuja un triángulo, el Android de fábrica daba **59 FPS** (el tope de la pantalla) con la app al ~7 % de CPU. Mi CM7 daba **25 FPS** con la app al **90 %**, casi todo en kernel. Un solo triángulo no puede costar eso, y un Gingerbread no debería ir más lento que un ICS. Lo que sigue es el camino, con las tres pistas falsas incluidas.

**Pista falsa 1: triple buffer.** Subir `Layer::NUM_BUFFERS` de 2 a 3 en SurfaceFlinger dejó la tablet en bucle de arranque; lo revertí.

**La GPU de punta a punta.** La sospecha razonable era mezclar el userland Mali de ICS (r2p4) con el framework de Gingerbread. Allwinner publicó su kernel con el driver Mali en r2p1, r2p2 y r2p3, y el userland de Gingerbread que existe (de `sztupy`) es r2p2. Compilé `mali.ko` y `ump.ko` r2p2 para el kernel 3.0.8 de la tablet. Tres obstáculos:
- El kernel exige que cada símbolo importado coincida en CRC (`modversions`). Generé un `Module.symvers` leyendo los CRC de los módulos de fábrica (586 símbolos, 0 conflictos). Sin él, `insmod` falla con «no symbol version for module_layout» y SurfaceFlinger se cae.
- El `vermagic` salía `3.0.8+` (el `+` lo añade git); hay que apartar `.git` para que sea `3.0.8`.
- El r2p2 del volcado **no activa el reloj de la GPU**; le copié la lógica del r2p4 de fábrica.

Resultado: **42 FPS**. Mejor, pero la CPU seguía saturada.

**Pista falsa 2: el driver Mali.** Un hilo pasaba el 90 % del tiempo en una espera activa del kernel (`__delay`). Instrumenté `_mali_osk_time_ubusydelay`: sumaba 164 ms en 190 s (0,25 % de CPU). No era Mali.

**Pista falsa 3: la gestión de energía.** Quitar el apagado de la PMU no cambió los FPS, y compilar sin PMM dejó la pantalla en negro. Ahí aprendí a vigilar el arranque con tres condiciones (módulo cargado, `Boot is finished`, animación parada), porque `boot_completed` salta a 1 aunque la pantalla esté negra.

**La pista buena.** `strace` rotulaba mal las llamadas (usa la tabla OABI de ARM). Escribí un programa de prueba con números de llamada EABI conocidos y descubrí que `msgget` era en realidad `clock_gettime`. La llamada larga era `clock_gettime(3, …)`, es decir **`CLOCK_THREAD_CPUTIME_ID`**. Medido con otro programa:

| Reloj | µs por llamada |
| --- | --- |
| `CLOCK_REALTIME` | 1,5 |
| `CLOCK_MONOTONIC` | 2,5 |
| `CLOCK_PROCESS_CPUTIME_ID` | 1,7 |
| **`CLOCK_THREAD_CPUTIME_ID`** | **21 813** |

El kernel de la tablet tarda 22 ms girando en esa lectura. Y en Gingerbread la cola de buffers de cada ventana (`SharedBufferClient::dequeue()` y `queue()`) la lee **dos veces por fotograma** solo para rellenar `stats.totalTime`, una estadística que únicamente se imprime en `dumpsys SurfaceFlinger`. Hasta donde sé, ICS ya no tiene esa cola (no lo he comprobado en su código). El arreglo es leer el reloj monótono (parche desactivado por defecto, activable desde el `BoardConfig`). Resultado: **59 FPS con la app al 4 %**, igual que el Android de fábrica. Y como la lectura estaba en cada ventana, mejora toda la interfaz, no solo el test.

## La pantalla de bloqueo en un recuadro de 480×320

Tras un borrado limpio, la pantalla de bloqueo salía en un **recuadro de 480×320 centrado**, con el botón de volumen cortado por arriba y el candado por abajo. El layout usa `match_parent`, así que el problema no estaba en el XML. `dumpsys window windows` lo dijo enseguida:

```
Window{… Keyguard}: mAttrs=WM.LayoutParams{(0,0)(fillxfill) … compatible=true}
Surface: rect=(160,0) 480 x 320
```

La ventana iba en **modo compatibilidad**, como una app antigua hecha para pantallas pequeñas. La bandera sale de `CompatibilityInfo.supportsScreen()`, y el constructor por defecto de esa clase (el que usa el proceso del sistema) solo activaba `EXPANDABLE`, sin `LARGE_SCREENS` ni `XLARGE_SCREENS`. En un móvil de 480×320 nadie lo nota; en una tablet de 800×480 sí. Mi primer intento fue declarar `<supports-screens>` en el manifiesto de `framework-res`: **no sirvió** y lo revertí. El arreglo que funcionó fue añadir esas banderas en el constructor por defecto. Como toca a todas las ventanas del proceso del sistema, los diálogos también salen completos. Tras el cambio la ventana mide 800×432 y ya no lleva `compatible=true`.

![Pantalla de bloqueo de CM7 a pantalla completa en la PAD703](/img/pad703-cm7/bloqueo.png)

Y como la tablet no admite SIM, el texto «(No service)» del operador sobraba: un parche en `LockScreen` lo oculta si la propiedad `ro.lockscreen.hide_carrier` es `true`, y la pone solo este dispositivo, así que los demás no cambian.

## Dos firmwares, o dos tablets

El primer volcado de la tablet decía build `20120725`, kernel del 26 de julio, con `dmard06` y Wi-Fi funcionando. El backup de TWRP era build `20120709`. Tengo dos unidades y sospecho que el volcado era de la otra, pero no lo comprobé. Las diferencias son de hardware (acelerómetro) y de firmware, y el adb las muestra con el mismo número de serie genérico de Allwinner.

## Lecciones de método

- **Verificar dentro del zip**, no solo "compiló sin errores". Así encontré tres cosas que parecían hechas: el `build.prop`, las apps sobrantes y el parche de reinicio.
- **`make` no rastrea las banderas del compilador.** Cambiar `CFLAGS` no recompila el objeto: borrar los intermedios. Tras cambiar propiedades, `make installclean`.
- **El adb por USB deja de responder mientras la tablet duerme**; lo vi con las marcas de hora del log. Un *wakelock* (`/sys/power/wake_lock`) para las pruebas largas.
- **Los datos de otra versión de Android rompen el arranque.** Backup verificado antes de borrar.
- Cuando algo "debería" existir y no existe, **leer el chip directamente** antes de fiarse del nombre del driver.
- **Medir antes de suponer.** Tres hipótesis plausibles (triple buffer, el driver Mali, la energía de la PMU) eran falsas; lo que resolvió el problema fue medir cada reloj por separado.
- **Calibrar las herramientas.** Un `strace` antiguo rotulaba mal las llamadas; un programa de prueba con números conocidos lo aclaró en minutos.
- **Vigilar con condiciones estrictas.** «El sistema arranca» no basta si la pantalla está en negro: comprobar el módulo cargado, `Boot is finished` y la animación parada, y restaurar solo si falla.
- **Probar también una instalación limpia.** Con los datos de siempre el Wi-Fi funcionaba; solo el primer arranque tras un `wipe` mostró que faltaba un directorio. Lo que «ya funciona» puede depender del estado que dejaron pruebas anteriores.
- **La suspensión se prueba con el USB desenchufado.** El kernel (`sw_udc`) se niega a dormir con el cable conectado (error -16), así que con adb puesto cualquier prueba de suspensión es inválida. Con la tablet sola, 4,4 minutos dormida y GPU, cámara, audio y Wi-Fi funcionaron al despertar.
- **Preguntarle al sistema, no suponer.** `dumpsys window windows` dio la causa de la pantalla recortada en un comando, tras sospechar del layout.
- **Verificar la subida de archivos.** Con la memoria interna al 99 %, `adb push` decía «1 file pushed» sin guardar nada; compruebo el `md5` del zip en la tablet antes de instalar.

## Estado

| Funciona (lo vi en pantalla) | Pendiente |
| --- | --- |
| Arranque, pantalla, táctil, barra de estado abajo | AMR/MMS (el HAL de captura ignora los 8 kHz) |
| GPU Mali r2p2 con 59 FPS, acelerómetro y giro | H.264 más rápido (hoy 5,8 fps; quizá con el codificador por hardware de Allwinner) |
| Wi-Fi (WPA2, DHCP, internet) | Tamaños de cámara distintos de 640×480 |
| Audio por el altavoz | Suspensión profunda con el Wi-Fi encendido (el driver Realtek mantiene un *wake-lock*; gasta batería) |
| Cámara frontal VGA: vista previa, foto con EXIF y vídeo (MPEG-4 a 13 fps) | |
| microSD en `/mnt/extsd` | |
| Reiniciar → Recovery desde el menú | |
| Sin Mensajes, Teléfono ni Contactos; Bluetooth sin servicio | |
| Backup y restore con TWRP | |
| Pantalla de bloqueo a pantalla completa y sin texto de operador | |

La densidad se dejó en 160: con 120 todo se veía pequeño.

Para dar la ROM por estable la probé así: cinco arranques en frío seguidos, dos primeros arranques tras un borrado de datos, una prueba de GPU de 9 minutos, ciclos de Wi-Fi, cámara en bucle y una suspensión real. La cámara frontal es un VGA (0,3 MP) y no hay otro sensor; en el Android de fábrica también lo era.

![Prueba OpenGL ES en CM7: Mali-400 MP a 59 FPS](/img/pad703-cm7/opengl-59fps.png)
