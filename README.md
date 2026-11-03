# chijure.github.io

Sitio personal y blog de Jhuan Reategui Solis, publicado con GitHub Pages en
<https://chijure.github.io>. Generado con [Hugo](https://gohugo.io) (sitio estático,
sin Node), en español (`/es/`) e inglés (`/en/`).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `content/es/blog/`, `content/en/blog/` | Artículos en Markdown |
| `data/projects.json` | Proyectos de la portada (textos `{ es, en }`) |
| `i18n/es.yaml`, `i18n/en.yaml` | Textos de la interfaz |
| `layouts/` | Plantillas |
| `assets/css/main.css` | Estilos (tema oscuro/claro automático) |
| `hugo.toml` | Configuración |

## Escribir un artículo

Crear el archivo con el **mismo nombre** en cada idioma (así Hugo los enlaza como traducciones
y el selector ES/EN salta de uno a otro):

```
content/es/blog/mi-articulo.md
content/en/blog/mi-articulo.md
```

```markdown
---
title: "Título"
date: 2026-11-02
description: "Resumen para el listado y para compartir el enlace."
tags: [android, kernel]
draft: true
---

Texto en Markdown. Los bloques de código se resaltan solos.
```

- `draft: true` no se publica. Cambiar a `false` (o quitar la línea) para publicarlo.
- Un artículo con **fecha futura** tampoco se publica hasta ese día.
- El enlace "Blog" y el RSS (`/es/blog/index.xml`) aparecen solos cuando hay algún artículo publicado.
- Si un artículo existe en un solo idioma, solo aparece en ese idioma.
- Las imágenes van en `static/` y se enlazan como `/img/foto.png`.

## Desarrollo local

Hugo 0.169.0 (un binario, <https://github.com/gohugoio/hugo/releases>):

```bash
hugo server -D      # vista previa con borradores, en http://localhost:1313
hugo --minify       # build de producción en public/
```

## Despliegue

`.github/workflows/deploy.yml` compila con Hugo y publica en cada push a `main`.
En el repositorio: Settings → Pages → Source: **GitHub Actions**.

Al crear un repositorio `usuario.github.io`, GitHub activa Pages por **rama** y puede publicar el
código sin compilar. Cambiar la fuente a GitHub Actions (o
`gh api -X PUT repos/<usuario>/<repo>/pages -f build_type=workflow`) y, si ya se publicó mal,
lanzar `gh workflow run deploy.yml`. La CDN guarda cada página 10 minutos: probar con Ctrl+Shift+R.

## Proyectos de la portada

Editar `data/projects.json`: cada proyecto lleva `summary` (y `status` opcional) como
`{ "es": "...", "en": "..." }`. Usar solo repositorios públicos.
