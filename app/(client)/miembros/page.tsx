import { Users } from 'lucide-react'

export default function MiembrosPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="page-title">Miembros</h1>
      <p className="page-subtitle mb-6">Directorio de la comunidad</p>
      <div className="card flex flex-col items-center text-center py-14">
        <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mb-4">
          <Users size={22} className="text-cream-muted" />
        </div>
        <p className="text-sm font-medium text-cream">Próximamente</p>
        <p className="text-sm text-cream-muted mt-1 max-w-sm">
          Aquí verás a los demás miembros de la comunidad y sus presentaciones.
        </p>
      </div>
    </div>
  )
}
