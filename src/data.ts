export type Lang = 'es' | 'en';
export type L = Record<Lang, string>;

export type Link = { label: string | L; href: string };

export type Item = {
  name: string;
  summary: L;
  tags: string[];
  links: Link[];
  status?: L;
};

const org = 'https://github.com/chijure-android-system-development';
const me = 'https://github.com/chijure';

const code: L = { es: 'Código', en: 'Code' };
const repo: L = { es: 'Repositorio', en: 'Repository' };

export const profile = {
  name: 'Jhuan Reategui Solis',
  handle: 'chijure',
  github: me,
  web: 'https://www.reateguisolisjm.com',
  org,
};

export const strings = {
  title: {
    es: 'Jhuan Reategui Solis — Arquitecto de software y ports de Android',
    en: 'Jhuan Reategui Solis — Software architect and Android ports',
  },
  description: {
    es: 'Portafolio de Jhuan Reategui Solis: ports de CyanogenMod, recoveries, kernels, investigación de bootloaders y desarrollo de software.',
    en: 'Portfolio of Jhuan Reategui Solis: CyanogenMod ports, recoveries, kernels, bootloader research and software development.',
  },
  skip: { es: 'Saltar al contenido', en: 'Skip to content' },
  mainNav: { es: 'Principal', en: 'Main' },
  langLabel: { es: 'Idioma', en: 'Language' },
  roles: {
    es: 'Arquitecto de software · Docente · Catequista',
    en: 'Software architect · Teacher · Catechist',
  },
  intro: {
    es: 'Diseño y construyo software, y en mis ratos libres devuelvo la vida a celulares antiguos: ports de CyanogenMod, recoveries, kernels e ingeniería inversa de bootloaders.',
    en: 'I design and build software, and in my spare time I bring old phones back to life: CyanogenMod ports, recoveries, kernels and bootloader reverse engineering.',
  },
  ctaGithub: { es: 'GitHub', en: 'GitHub' },
  ctaAndroid: { es: 'Proyectos Android', en: 'Android projects' },
  ctaWeb: { es: 'Sitio personal', en: 'Personal site' },
  tagsLabel: { es: 'Tecnologías', en: 'Technologies' },
  aboutTitle: { es: 'Perfil', en: 'About' },
  aboutText: {
    es: 'Trabajo como arquitecto de software, enseño y participo como catequista. Me gusta explicar lo que construyo: cada port que publico lleva su estado real, las pruebas hechas y lo que todavía no funciona.',
    en: 'I work as a software architect, I teach and I serve as a catechist. I like to explain what I build: every port I publish states its real status, the tests done and what still does not work.',
  },
  skillsTitle: { es: 'Tecnologías', en: 'Technologies' },
  skillsLabel: { es: 'Tecnologías que uso', en: 'Technologies I use' },
} satisfies Record<string, L>;

export const sections = {
  android: {
    title: { es: 'Ports de Android', en: 'Android ports' },
    lead: {
      es: 'Equipos que ya nadie actualiza, de nuevo en marcha: ROMs, recoveries y kernels construidos desde el código fuente.',
      en: 'Phones nobody updates anymore, running again: ROMs, recoveries and kernels built from source.',
    },
  },
  tools: {
    title: { es: 'Herramientas', en: 'Tools' },
    lead: {
      es: 'Lo que fui necesitando para probar, documentar y publicar mejor ese trabajo.',
      en: 'What I needed along the way to test, document and publish that work better.',
    },
  },
  research: {
    title: { es: 'Hardware e investigación', en: 'Hardware and research' },
    lead: {
      es: 'Bootloaders, recuperación de equipos y arreglos de hardware, probados siempre en el equipo real.',
      en: 'Bootloaders, device recovery and hardware fixes, always tested on the real device.',
    },
  },
  software: {
    title: { es: 'Desarrollo de software', en: 'Software development' },
    lead: {
      es: 'Aplicaciones móviles y web, además de plugins para la comunidad.',
      en: 'Mobile and web applications, plus plugins for the community.',
    },
  },
} satisfies Record<string, { title: L; lead: L }>;

export const android: Item[] = [
  {
    name: 'LG Optimus Pro C660',
    summary: {
      es: 'CyanogenMod 7 (Android 2.3.7) con kernel 2.6.35 propio, teclado QWERTY, cámara y recovery TWRP 3.1.1 ajustado a una partición de solo 5 MB.',
      en: 'CyanogenMod 7 (Android 2.3.7) with its own 2.6.35 kernel, QWERTY keyboard, camera and a TWRP 3.1.1 recovery squeezed into a 5 MB partition.',
    },
    tags: ['CM7', 'MSM7227T', 'Kernel', 'TWRP'],
    status: { es: 'En pruebas', en: 'Testing' },
    links: [{ label: 'Device tree', href: `${org}/android_device_lge_c660` }],
  },
  {
    name: 'LG Optimus L3 (E400)',
    summary: {
      es: 'CyanogenMod 7 funcionando, con modo USB host (OTG) por interruptor de software para equipos sin el pin ID cableado.',
      en: 'CyanogenMod 7 running, with USB host (OTG) mode behind a software switch for devices without a wired ID pin.',
    },
    tags: ['CM7', 'USB OTG'],
    links: [
      { label: 'Device tree', href: `${org}/android_device_lge_e400` },
      { label: 'OtgSwitch', href: `${org}/android_packages_apps_OtgSwitch` },
    ],
  },
  {
    name: 'Huawei Y210',
    summary: {
      es: 'Port de CyanogenMod 7 con kernel Phoenix, incluida la radio FM.',
      en: 'CyanogenMod 7 port with the Phoenix kernel, FM radio included.',
    },
    tags: ['CM7', 'Kernel'],
    links: [
      { label: 'Device tree', href: `${org}/android_device_huawei_y210` },
      { label: 'Kernel', href: `${org}/android_kernel_huawei_y210` },
    ],
  },
  {
    name: 'Huawei Y220',
    summary: {
      es: 'CyanogenMod 7 sobre MediaTek MT6572 (NAND/UBIFS): Bluetooth con A2DP, FM, llamadas, video por hardware, anclaje USB y zona Wi-Fi.',
      en: 'CyanogenMod 7 on MediaTek MT6572 (NAND/UBIFS): Bluetooth with A2DP, FM, calls, hardware video, USB tethering and Wi-Fi hotspot.',
    },
    tags: ['CM7', 'MT6572', 'TWRP'],
    status: { es: 'Beta', en: 'Beta' },
    links: [
      { label: 'Device tree', href: `${org}/android_device_huawei_y220` },
      { label: 'Kernel', href: `${org}/android_kernel_huawei_y220-u05` },
    ],
  },
  {
    name: 'LG G2 mini D625 (Tegra 4i)',
    summary: {
      es: 'Recovery TWRP y parche del bootloader probados en hardware real, con instalación por nvflash y verificación de lectura.',
      en: 'TWRP recovery and bootloader patch tested on real hardware, installed with nvflash and checked by reading the flash back.',
    },
    tags: ['Tegra 4i', 'Bootloader', 'TWRP'],
    links: [
      { label: 'Device tree', href: `${org}/android_device_lge_g2mv` },
      { label: 'Bootloader', href: `${org}/lg-d625-tegra-bootloader-patch` },
    ],
  },
  {
    name: 'LG L4 II, L5 II / L50',
    summary: {
      es: 'Árboles de dispositivo de CyanogenMod 10 y TWRP para equipos MediaTek MT6575 y MT6572.',
      en: 'CyanogenMod 10 and TWRP device trees for MediaTek MT6575 and MT6572 phones.',
    },
    tags: ['CM10', 'MT6575', 'MT6572'],
    links: [
      { label: 'L4 II / L5 II', href: `${org}/android_device_lge_mt6575-common` },
      { label: 'L50', href: `${org}/android_device_lge_luv50ss` },
    ],
  },
];

export const tools: Item[] = [
  {
    name: 'QApp ROM Tester',
    summary: {
      es: 'App de Android para comprobar qué hardware funciona en una ROM: sensores, cámara, Wi-Fi, Bluetooth, video, GPU y batería, con informe por pasos que sobrevive a un reinicio. Compatible desde Android 2.2 y pantallas QVGA.',
      en: 'Android app that checks which hardware works on a ROM: sensors, camera, Wi-Fi, Bluetooth, video, GPU and battery, with a step-by-step report that survives a reboot. Works from Android 2.2 and on QVGA screens.',
    },
    tags: ['Android', 'Java'],
    links: [{ label: code, href: `${me}/romtester` }],
  },
  {
    name: 'XDA posts archive',
    summary: {
      es: '20 publicaciones en BBCode de kernels, ROMs, recoveries y guías para equipos LG y Alcatel.',
      en: '20 BBCode posts about kernels, ROMs, recoveries and guides for LG and Alcatel phones.',
    },
    tags: ['BBCode', 'Docs'],
    links: [{ label: repo, href: `${me}/xda-posts` }],
  },
  {
    name: 'BBCode Preview',
    summary: {
      es: 'Previsualizador de BBCode en tiempo real con barra de etiquetas, vista segura, i18n y pruebas, publicado en GitHub Pages.',
      en: 'Live BBCode previewer with a tag toolbar, safe rendering, i18n and tests, published on GitHub Pages.',
    },
    tags: ['React', 'Vite', 'TypeScript'],
    links: [
      { label: { es: 'Demo', en: 'Demo' }, href: 'https://chijure.github.io/bbcode-preview/' },
      { label: code, href: `${me}/bbcode-preview` },
    ],
  },
  {
    name: 'BBCode for VS Code',
    summary: {
      es: 'Extensión de Visual Studio Code con soporte para BBCode.',
      en: 'Visual Studio Code extension with BBCode support.',
    },
    tags: ['VS Code', 'JavaScript'],
    links: [{ label: code, href: `${me}/BBCode-Code` }],
  },
];

export const research: Item[] = [
  {
    name: 'LG D625: APX recovery',
    summary: {
      es: 'Miniloader ARMv4T verificado, lectura y escritura de la eMMC e investigación del bootloader de la Tegra 4i.',
      en: 'Verified ARMv4T miniloader, eMMC read and write, and research into the Tegra 4i bootloader.',
    },
    tags: ['Tegra 4i', 'APX', 'eMMC'],
    links: [{ label: repo, href: `${me}/lg-d625-tegra4i-recovery` }],
  },
  {
    name: 'LG D625: EBT v2 patch',
    summary: {
      es: 'Arranque de recovery con firma alterada, probado en hardware, con instalación gestionada por nvflash y verificación de lectura.',
      en: 'Recovery boot with an altered signature, hardware-tested, installed through nvflash and verified by readback.',
    },
    tags: ['Bootloader', 'nvflash'],
    links: [{ label: repo, href: `${org}/lg-d625-tegra-bootloader-patch` }],
  },
  {
    name: 'LG E450g: LK patch',
    summary: {
      es: 'Parche del bootloader LK (MT6575) para arrancar recoveries sin firmar sin el error de seguridad.',
      en: 'Patch for the LK bootloader (MT6575) to boot unsigned recoveries without the security error.',
    },
    tags: ['MT6575', 'LK'],
    links: [{ label: repo, href: `${org}/lg-e450g-lk-patch` }],
  },
  {
    name: 'macbook-backlight-boost',
    summary: {
      es: 'Corrige pantallas de reemplazo tenues en MacBooks Intel reescalando la retroiluminación de macOS para igualar el brillo de Windows/Boot Camp.',
      en: 'Fixes dim replacement screens on Intel MacBooks by rescaling the macOS backlight to match Windows/Boot Camp brightness.',
    },
    tags: ['macOS', 'JavaScript'],
    links: [{ label: repo, href: `${me}/macbook-backlight-boost` }],
  },
];

export const software: Item[] = [
  {
    name: 'ionic-marketplace',
    summary: {
      es: 'Marketplace móvil con Ionic y Capacitor.',
      en: 'Mobile marketplace built with Ionic and Capacitor.',
    },
    tags: ['Ionic', 'Capacitor', 'TypeScript'],
    links: [{ label: code, href: `${me}/ionic-marketplace` }],
  },
  {
    name: 'movie-app',
    summary: {
      es: 'Aplicación de películas en Kotlin con MVVM y Clean Architecture.',
      en: 'Movie app in Kotlin using MVVM and Clean Architecture.',
    },
    tags: ['Kotlin', 'MVVM', 'Clean Architecture'],
    links: [{ label: code, href: `${me}/movie-app` }],
  },
  {
    name: 'call-activity',
    summary: {
      es: 'Plugin comunitario de Capacitor para llamar a Activities propias de Android.',
      en: 'Community Capacitor plugin to launch your own Android Activities.',
    },
    tags: ['Capacitor', 'Java'],
    links: [
      { label: 'Plugin', href: `${me}/call-activity` },
      { label: { es: 'Ejemplo', en: 'Example' }, href: `${me}/ionic-capacitor-call-own-activities` },
    ],
  },
];

export const skills = [
  'TypeScript', 'JavaScript', 'Java', 'Kotlin', 'PHP', 'C / C++', 'C#',
  'Angular', 'React', 'Ionic', 'Laravel', 'Spring', '.NET',
  'MySQL', 'Firebase', 'Git', 'Android', 'Linux',
];
