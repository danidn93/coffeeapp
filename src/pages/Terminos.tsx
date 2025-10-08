// src/pages/Terminos.tsx
const Terminos = () => (
  <div className="min-h-screen py-20 px-4 bg-background">
    <div className="container mx-auto max-w-3xl prose prose-invert">
      <h1>Términos y Condiciones</h1>
      <p>Última actualización: {new Date().toLocaleDateString()}</p>
      <h2>1. Introducción</h2>
      <p>Estos términos regulan el uso de nuestros servicios…</p>
      <h2>2. Reservas y consumo</h2>
      <p>…</p>
      <h2>3. Responsabilidades</h2>
      <p>…</p>
      {/* Completa con tus políticas reales */}
    </div>
  </div>
);
export default Terminos;
