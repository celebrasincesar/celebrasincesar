// ─────────────────────────────────────────────────────────────────────────────
// PROMOS / CÓDIGOS DE DESCUENTO
// Editá este archivo para crear, cambiar o apagar promociones. El papá escribe
// el código al final del armador y el descuento se aplica solo.
//
// tipo 'porcentaje_item' → % de descuento sobre UN ítem de la categoría objetivo
//   (se aplica al ítem elegible de MAYOR valor de su selección, para que le
//   convenga). Si no tiene ningún ítem de esa categoría, se le pide agregarlo.
//
// Campos:
//   codigo     lo que el papá escribe (no distingue mayúsculas/minúsculas)
//   etiqueta   texto corto para mostrar (ej. "50% en un inflable")
//   tipo       'porcentaje_item'
//   valor      porcentaje de descuento (ej. 50)
//   categoria  id de la categoría en CATEGORIAS_ADICIONALES (ej. 'inflables')
//   activa     false para apagarla sin borrarla
//   vence      opcional 'YYYY-MM-DD' (último día válido, inclusive)
//
// ⚠️ El código vive en el sitio → cualquiera que lo conozca puede usarlo (no es
//    de un solo uso ni rastreable sin base de datos). Ideal para campañas.
// ─────────────────────────────────────────────────────────────────────────────

export const PROMOS = [
  {
    codigo: 'ALCE50',
    etiqueta: '50% en un inflable',
    tipo: 'porcentaje_item',
    valor: 50,
    categoria: 'inflables',
    activa: true,
    // vence: '2026-12-31',
  },
];

// Devuelve la promo válida para un código, o null (no existe / apagada / vencida).
export function buscarPromo(codigo) {
  if (!codigo) return null;
  const c = String(codigo).trim().toUpperCase();
  if (!c) return null;
  const p = PROMOS.find((x) => x.codigo.toUpperCase() === c);
  if (!p || p.activa === false) return null;
  if (p.vence) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const fin = new Date(`${p.vence}T23:59:59`);
    if (isNaN(fin) || hoy > fin) return null; // vencida
  }
  return p;
}
