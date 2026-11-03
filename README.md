# chijure.github.io

Sitio personal de Jhuan Reategui Solis, publicado con GitHub Pages en
<https://chijure.github.io>.

React 19 + Vite + TypeScript, sin dependencias de ejecución más allá de React.
Los proyectos se escriben a mano en `src/data.ts` para no depender de la API de
GitHub (límite de peticiones) y para que cada descripción diga solo lo que está
comprobado.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run lint
npm run build    # genera dist/
```

No hay Node en el equipo de desarrollo habitual; se usa un contenedor:

```bash
docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/app -w /app node:20 npm run build
```

## Despliegue

`.github/workflows/deploy.yml` compila y publica en Pages en cada push a `main`.
En el repositorio: Settings → Pages → Source: **GitHub Actions**.

Al crear un repositorio `usuario.github.io`, GitHub activa Pages por **rama** y publica el
código sin compilar (página en blanco: `/src/main.tsx` no existe como JS). Hay que cambiar
la fuente a GitHub Actions antes del primer push (o con
`gh api -X PUT repos/<usuario>/<repo>/pages -f build_type=workflow`) y, si ya se
publicó mal, lanzar `gh workflow run deploy.yml`. La CDN guarda la página 10 minutos:
probar con Ctrl+Shift+R.

## Para añadir un proyecto

Agregar un objeto a la lista que corresponda en `src/data.ts`
(`android`, `tools`, `research` o `software`). Usar solo repositorios públicos.
