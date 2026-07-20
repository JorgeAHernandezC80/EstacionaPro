# CHANGELOG — Auditoría y mejoras de frontend

## Añadido en esta pasada

**Adaptabilidad a pantallas (`CSS/base/responsive.css`, enlazado en las 7 páginas)**
- Refinamiento de tablets (601–1024px): grids de 3–4 columnas pasan a 2.
- Escritorio ancho (≥1440px) y Smart TV (≥1920px): contenedor más ancho,
  tipografía base mayor (19px) y foco visible más grueso para navegación
  con control remoto — visualización a distancia ("10-foot UI").
- Dispositivos táctiles (`hover:none`/`pointer:coarse`): objetivos de toque
  ≥44px según WCAG 2.5.5.
- Orientación horizontal en móviles de poca altura.
- `prefers-contrast: more` para accesibilidad visual.
- Hoja de estilos de impresión (útil para comprobantes de reserva/tarifas).

**Automatización de tareas (`package.json`, `scripts/build.js`)**
- `npm run lint` → ESLint (JS) + Stylelint (CSS).
- `npm run format` → Prettier sobre JS/CSS/HTML.
- `npm run build` → `scripts/build.js` minifica CSS (clean-css) y empaqueta/
  minifica cada entry point de `JS/pages/*.js` con esbuild hacia `/dist`,
  sin tocar el código fuente. Pensado para correr antes de desplegar a Netlify.
- `npm run validate:html` → html-validate sobre las páginas.
- Configs incluidas: `eslint.config.mjs`, `.stylelintrc.json`, `.prettierrc.json`.

## Ya presente en el proyecto (verificado, sin cambios)
- HTML semántico correcto: `header/nav/main/section/article/footer`,
  `skip-link`, `aria-label` en elementos interactivos, JSON-LD de SEO.
- CSS con tokens de diseño (`variables.css`), modo claro/oscuro, `clamp()`
  para tipografía fluida y grids `auto-fit` que ya cubren buena parte de
  la adaptabilidad sin depender de breakpoints fijos.
- JS con buenas prácticas de rendimiento: scroll listener `passive` +
  `requestAnimationFrame`, `IntersectionObserver` con fallback, módulos ES.
- `prefers-reduced-motion` respetado en `reset.css`.

## Pendiente por priorizar (requiere tu decisión, no se tocó)
1. **Instalar y correr** `npm install` para que `lint`/`build`/`validate:html`
   funcionen (las dependencias se agregaron a `package.json` pero no se
   instalaron en este entorno).
2. Definir si `npm run build` se integra al pipeline de Netlify (build
   command) o se queda como paso manual antes de deploy.
3. Revisar `operacion.html`/`admin.html` y `reservar.html` con el mismo
   nivel de detalle que `index.html` (formularios, tablas, estados de carga)
   si quieres que audite esas páginas específicamente.
4. Optimización de imágenes: solo hay `IMG/og-cover.png` (1.6MB) —
   conviene comprimirla o convertirla a WebP si se van a agregar más fotos.
