'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { toast } from '@/lib/toast'

interface Mentor { id: string; nombre: string; activo: boolean }

export default function MentorCrud({ mentores }: { mentores: Mentor[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(body: Record<string, unknown>) {
    setSaving(true)
    const res = await fetch('/api/admin/mentores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'No se pudo guardar')
      return false
    }
    return true
  }

  async function createMentor() {
    if (!newName.trim()) return
    if (await save({ nombre: newName.trim(), activo: true })) {
      toast.success('Mentor creado.')
      setNewName(''); setCreating(false)
      router.refresh()
    }
  }

  async function renameMentor(id: string) {
    if (!editValue.trim()) return
    if (await save({ id, nombre: editValue.trim(), activo: true })) {
      toast.success('Mentor actualizado.')
      setEditingId(null)
      router.refresh()
    }
  }

  async function toggleActivo(m: Mentor) {
    if (await save({ id: m.id, nombre: m.nombre, activo: !m.activo })) {
      router.refresh()
    }
  }

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-cream">Mentores</p>
          <p className="text-xs text-cream-muted">Dictan las clases grupales — sin acceso a la plataforma</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-secondary">
            <Plus size={14} /> Nuevo mentor
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text" className="input" placeholder="Nombre del mentor" autoFocus
            value={newName} onChange={e => setNewName(e.target.value)}
          />
          <button onClick={createMentor} disabled={saving} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10" aria-label="Guardar">
            <Check size={16} />
          </button>
          <button onClick={() => { setCreating(false); setNewName('') }} className="p-2 rounded-lg text-cream-muted hover:bg-surface-800" aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>
      )}

      {mentores.length === 0 && !creating ? (
        <p className="text-sm text-cream-muted">Sin mentores creados todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {mentores.map(m => (
            <div key={m.id} className="flex items-center gap-2 bg-surface-800 rounded-lg px-3 py-2">
              {editingId === m.id ? (
                <>
                  <input
                    type="text" className="input flex-1" autoFocus
                    value={editValue} onChange={e => setEditValue(e.target.value)}
                  />
                  <button onClick={() => renameMentor(m.id)} disabled={saving} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10" aria-label="Guardar">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-cream-muted hover:bg-surface-700" aria-label="Cancelar">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${m.activo ? 'text-cream' : 'text-cream-muted line-through'}`}>{m.nombre}</span>
                  <button
                    onClick={() => toggleActivo(m)}
                    className={`text-xs px-2 py-1 rounded-lg ${m.activo ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-cream-muted hover:bg-surface-700'}`}
                  >
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button
                    onClick={() => { setEditingId(m.id); setEditValue(m.nombre) }}
                    className="p-1.5 rounded-lg text-cream-muted hover:text-cream hover:bg-surface-700"
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
