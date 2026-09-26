// ══════════════════════════════════════════════════════════════════════
// Loader hook mínimo: permite que un script node suelto importe archivos
// del proyecto con rutas SIN extensión ('./db', '../data/reglas'), que es
// como el resto del proyecto ya las escribe y como las resuelve Next.js.
// Node "a pelo" exige la extensión explícita en imports relativos —esto
// es lo único que ese hueco necesita, nada más.
//
// Uso: import { register } from 'node:module'; register('./_resolver-sin-extension.mjs', import.meta.url)
// ══════════════════════════════════════════════════════════════════════

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(specifier + '.js', context);
    }
    throw err;
  }
}
