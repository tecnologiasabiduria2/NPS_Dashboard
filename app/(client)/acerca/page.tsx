import Image from 'next/image'

export default function AcercaPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Acerca de</h1>
      <p className="page-subtitle mb-6">La comunidad de Sabiduría Empresarial</p>
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Image src="/logo-icon.png" alt="Sabiduría Empresarial" width={36} height={36} className="object-contain" />
          <div>
            <p className="text-sm font-semibold text-cream">Sabiduría Empresarial</p>
            <p className="text-xs text-cream-muted">Comunidad privada</p>
          </div>
        </div>
        <p className="text-sm text-cream-dim leading-relaxed">
          Este es tu espacio para acceder a tu aprendizaje, eventos en vivo, tu ruta
          de acompañamiento y la comunidad. Usa las pestañas de arriba para navegar
          entre cada sección.
        </p>
      </div>
    </div>
  )
}
