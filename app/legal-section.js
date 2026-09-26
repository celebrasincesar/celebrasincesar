// ─────────────────────────────────────────────────────────────────────
// Componente compartido de sección numerada para documentos legales
// (T&C y Política de Privacidad) — antes vivía duplicado dentro de
// app/terminos/page.js; se extrajo para que ambos documentos usen
// exactamente el mismo look, sin dos copias que puedan divergir.
// ─────────────────────────────────────────────────────────────────────
export default function Section({ num, titulo, children }) {
  return (
    <section className="mb-8">
      <h2
        className="text-lg font-black mb-3 pb-2"
        style={{
          color: '#1565C0',
          borderBottom: '2px solid #DBEAFE',
          display: 'flex',
          gap: '8px',
          alignItems: 'baseline',
        }}
      >
        <span
          className="text-xs font-black rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0"
          style={{ background: '#1565C0', color: 'white', lineHeight: 1, paddingTop: '1px' }}
        >
          {num}
        </span>
        {titulo}
      </h2>
      <div
        className="text-sm leading-relaxed space-y-2"
        style={{ color: '#374151' }}
      >
        {children}
      </div>
    </section>
  );
}
