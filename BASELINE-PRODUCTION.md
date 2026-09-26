# Baseline Production — Fase 4A

- Deployment Production: `dpl_2fbRQkcuw4KCog9wEDJotdxjjzxT` (celebrasincesar.cl y www.celebrasincesar.cl)
- Tag: `production-2026-09-26-fase4a` (el commit baseline es el que apunta este tag: `git rev-list -n1 production-2026-09-26-fase4a`)
- Fecha: 2026-09-26
- QA: 520 pruebas numerables en 18 suites + `qa-precios` y `qa-emoji` (exit 0, sin contador); las 20 suites con exit 0
- Build: PASS (`npm run build`)
- Deployment anterior conocido-bueno (rollback previo a 4A): `dpl_yNya4H22rKPDz6BeDX5XoVTAY7WK`

## Rollback
- Código: `git checkout production-2026-09-26-fase4a`.
- Production: re-apuntar `celebrasincesar.cl` y `www.celebrasincesar.cl` con `vercel alias set <deployment-url> <dominio>` (los dominios NO siguen solos a un nuevo deploy).

## Notas
- Los PNG antiguos del armador (`elige-tu-fecha`, `elige-tu-horario`, `buena-eleccion`) siguen en `public/` sin referencias; limpieza futura.
- Los secretos viven solo en variables de entorno de Vercel y `.env.local` (ignorado); nada sensible se versiona.
