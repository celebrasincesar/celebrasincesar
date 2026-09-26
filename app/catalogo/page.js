import CatalogoCliente from './catalogo-cliente';

// /catalogo — catálogo completo. Las rutas por categoría (/catalogo/inflables,
// /catalogo/animacion, ...) reutilizan EXACTAMENTE este mismo componente y los
// mismos datos: no existe una segunda versión del catálogo en ninguna parte.
export default function CatalogoPage() {
  return <CatalogoCliente />;
}
