export type Link = { label: string; href: string };

export type Item = {
  name: string;
  summary: string;
  tags: string[];
  links: Link[];
  status?: string;
};

export const profile = {
  name: 'Jhuan Reategui Solis',
  handle: 'chijure',
  roles: ['Arquitecto de software', 'Docente', 'Administrador', 'Catequista'],
  intro:
    'Diseño y construyo software, y en mis ratos libres devuelvo la vida a celulares ' +
    'antiguos: ports de CyanogenMod, recoveries, kernels e ingeniería inversa de bootloaders.',
  github: 'https://github.com/chijure',
  web: 'https://www.reateguisolisjm.com',
  org: 'https://github.com/chijure-android-system-development',
};

export const android: Item[] = [
  {
    name: 'LG Optimus Pro C660',
    summary:
      'CyanogenMod 7 (Android 2.3.7) con kernel 2.6.35 propio, teclado QWERTY, cámara y ' +
      'recovery TWRP 3.1.1 ajustado a una partición de solo 5 MB.',
    tags: ['CM7', 'MSM7227T', 'Kernel', 'TWRP'],
    status: 'En pruebas',
    links: [{ label: 'Device tree', href: 'https://github.com/chijure-android-system-development/android_device_lge_c660' }],
  },
  {
    name: 'LG Optimus L3 (E400)',
    summary:
      'CyanogenMod 7 funcionando, con modo USB host (OTG) por interruptor de software ' +
      'para equipos sin el pin ID cableado.',
    tags: ['CM7', 'USB OTG'],
    links: [
      { label: 'Device tree', href: 'https://github.com/chijure-android-system-development/android_device_lge_e400' },
      { label: 'OtgSwitch', href: 'https://github.com/chijure-android-system-development/android_packages_apps_OtgSwitch' },
    ],
  },
  {
    name: 'Huawei Y210',
    summary: 'Port de CyanogenMod 7 con kernel Phoenix, incluida la radio FM.',
    tags: ['CM7', 'Kernel'],
    links: [
      { label: 'Device tree', href: 'https://github.com/chijure-android-system-development/android_device_huawei_y210' },
      { label: 'Kernel', href: 'https://github.com/chijure-android-system-development/android_kernel_huawei_y210' },
    ],
  },
  {
    name: 'Huawei Y220',
    summary:
      'CyanogenMod 7 sobre MediaTek MT6572 (NAND/UBIFS): Bluetooth con A2DP, FM, llamadas, ' +
      'video por hardware, anclaje USB y zona Wi-Fi.',
    tags: ['CM7', 'MT6572', 'TWRP'],
    status: 'Beta',
    links: [
      { label: 'Device tree', href: 'https://github.com/chijure-android-system-development/android_device_huawei_y220' },
      { label: 'Kernel', href: 'https://github.com/chijure-android-system-development/android_kernel_huawei_y220-u05' },
    ],
  },
  {
    name: 'LG G2 mini D625 (Tegra 4i)',
    summary:
      'Recovery TWRP y parche del bootloader probados en hardware real, con instalación ' +
      'por nvflash y verificación de lectura.',
    tags: ['Tegra 4i', 'Bootloader', 'TWRP'],
    links: [
      { label: 'Device tree', href: 'https://github.com/chijure-android-system-development/android_device_lge_g2mv' },
      { label: 'Bootloader', href: 'https://github.com/chijure-android-system-development/lg-d625-tegra-bootloader-patch' },
    ],
  },
  {
    name: 'LG L4 II, L5 II y L50',
    summary: 'Árboles de dispositivo de CyanogenMod 10 y TWRP para equipos MediaTek MT6575 y MT6572.',
    tags: ['CM10', 'MT6575', 'MT6572'],
    links: [
      { label: 'L4 II / L5 II', href: 'https://github.com/chijure-android-system-development/android_device_lge_mt6575-common' },
      { label: 'L50', href: 'https://github.com/chijure-android-system-development/android_device_lge_luv50ss' },
    ],
  },
];

export const tools: Item[] = [
  {
    name: 'QApp ROM Tester',
    summary:
      'App de Android para comprobar qué hardware funciona en una ROM: sensores, cámara, Wi-Fi, ' +
      'Bluetooth, video, GPU y batería, con informe por pasos que sobrevive a un reinicio. ' +
      'Compatible desde Android 2.2 y pantallas QVGA.',
    tags: ['Android', 'Java'],
    links: [{ label: 'Código', href: 'https://github.com/chijure/romtester' }],
  },
  {
    name: 'Archivo de publicaciones de XDA',
    summary: '20 publicaciones en BBCode de kernels, ROMs, recoveries y guías para equipos LG y Alcatel.',
    tags: ['BBCode', 'Documentación'],
    links: [{ label: 'Repositorio', href: 'https://github.com/chijure/xda-posts' }],
  },
  {
    name: 'BBCode Preview',
    summary:
      'Previsualizador de BBCode en tiempo real con barra de etiquetas, vista segura, ' +
      'i18n y pruebas, publicado en GitHub Pages.',
    tags: ['React', 'Vite', 'TypeScript'],
    links: [
      { label: 'Demo', href: 'https://chijure.github.io/bbcode-preview/' },
      { label: 'Código', href: 'https://github.com/chijure/bbcode-preview' },
    ],
  },
  {
    name: 'BBCode para VS Code',
    summary: 'Extensión de Visual Studio Code con soporte para BBCode.',
    tags: ['VS Code', 'JavaScript'],
    links: [{ label: 'Código', href: 'https://github.com/chijure/BBCode-Code' }],
  },
];

export const research: Item[] = [
  {
    name: 'LG D625: recuperación por APX',
    summary:
      'Miniloader ARMv4T verificado, lectura y escritura de la eMMC e investigación del bootloader ' +
      'de la Tegra 4i.',
    tags: ['Tegra 4i', 'APX', 'eMMC'],
    links: [{ label: 'Repositorio', href: 'https://github.com/chijure/lg-d625-tegra4i-recovery' }],
  },
  {
    name: 'LG D625: parche del EBT v2',
    summary:
      'Arranque de recovery con firma alterada, probado en hardware, con instalación gestionada ' +
      'por nvflash y verificación de lectura.',
    tags: ['Bootloader', 'nvflash'],
    links: [{ label: 'Repositorio', href: 'https://github.com/chijure-android-system-development/lg-d625-tegra-bootloader-patch' }],
  },
  {
    name: 'LG E450g: parche del LK',
    summary: 'Parche del bootloader LK (MT6575) para arrancar recoveries sin firmar sin el error de seguridad.',
    tags: ['MT6575', 'LK'],
    links: [{ label: 'Repositorio', href: 'https://github.com/chijure-android-system-development/lg-e450g-lk-patch' }],
  },
  {
    name: 'macbook-backlight-boost',
    summary:
      'Corrige pantallas de reemplazo tenues en MacBooks Intel reescalando la retroiluminación de macOS ' +
      'para igualar el brillo de Windows/Boot Camp.',
    tags: ['macOS', 'JavaScript'],
    links: [{ label: 'Repositorio', href: 'https://github.com/chijure/macbook-backlight-boost' }],
  },
];

export const software: Item[] = [
  {
    name: 'ionic-marketplace',
    summary: 'Marketplace móvil con Ionic y Capacitor.',
    tags: ['Ionic', 'Capacitor', 'TypeScript'],
    links: [{ label: 'Código', href: 'https://github.com/chijure/ionic-marketplace' }],
  },
  {
    name: 'movie-app',
    summary: 'Aplicación de películas en Kotlin con MVVM y Clean Architecture.',
    tags: ['Kotlin', 'MVVM', 'Clean Architecture'],
    links: [{ label: 'Código', href: 'https://github.com/chijure/movie-app' }],
  },
  {
    name: 'call-activity',
    summary: 'Plugin comunitario de Capacitor para llamar a Activities propias de Android.',
    tags: ['Capacitor', 'Java'],
    links: [
      { label: 'Plugin', href: 'https://github.com/chijure/call-activity' },
      { label: 'Ejemplo', href: 'https://github.com/chijure/ionic-capacitor-call-own-activities' },
    ],
  },
];

export const skills = [
  'TypeScript', 'JavaScript', 'Java', 'Kotlin', 'PHP', 'C / C++', 'C#',
  'Angular', 'React', 'Ionic', 'Laravel', 'Spring', '.NET',
  'MySQL', 'Firebase', 'Git', 'Android', 'Linux',
];
