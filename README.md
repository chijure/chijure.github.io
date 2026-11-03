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

## Para añadir un proyecto

Agregar un objeto a la lista que corresponda en `src/data.ts`
(`android`, `tools`, `research` o `software`). Usar solo repositorios públicos.
