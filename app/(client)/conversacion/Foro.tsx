'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Heart, MessageCircle, Send, PenLine, Home, Hash, Megaphone, Smile, Users, LifeBuoy, Lock, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

export interface ForoComment {
  id: string
  author: string
  authorAvatar: string | null
  body: string
  createdAt: string
}
export interface ForoPost {
  id: string
  author: string
  authorAvatar: string | null
  category: string
  body: string
  createdAt: string
  likeCount: number
  likedByMe: boolean
  comments: ForoComment[]
}
export interface CommunityInfo {
  name: string
  memberCount: number
  avatars: { id: string; name: string; avatarUrl: string | null }[]
}

// Canales = categorías del foro (estilo Skool). El canal elige el filtro del feed
// y, al publicar, la categoría del post (sin desplegable).
const CHANNELS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'all', label: 'Todos', icon: Home },
  { value: 'general', label: 'General', icon: Hash },
  { value: 'anuncios', label: 'Anuncios', icon: Megaphone },
  { value: 'presentaciones', label: 'Presentaciones', icon: Smile },
  { value: 'networking', label: 'Networking', icon: Users },
  { value: 'soporte', label: 'Soporte', icon: LifeBuoy },
]
const channelLabel = (v: string) => CHANNELS.find(c => c.value === v)?.label ?? 'General'

// Color por categoría (chips), dentro de la paleta de marca.
const CAT_STYLE: Record<string, string> = {
  general: 'bg-surface-700 text-cream-dim',
  anuncios: 'bg-accent/15 text-accent',
  presentaciones: 'bg-brand-600/20 text-brand-300',
  networking: 'bg-emerald-500/15 text-emerald-300',
  soporte: 'bg-sky-500/15 text-sky-300',
}
const catStyle = (v: string) => CAT_STYLE[v] ?? CAT_STYLE.general

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
function when(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  return (
    <span className="rounded-full overflow-hidden bg-brand-700/50 border border-brand-600/30 flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-brand-300">{initials(name)}</span>
      )}
    </span>
  )
}

export default function Foro({ posts, community }: { posts: ForoPost[]; community: CommunityInfo }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<string>('all')

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: posts.length }
    for (const p of posts) m[p.category] = (m[p.category] ?? 0) + 1
    return m
  }, [posts])

  const visible = channel === 'all' ? posts : posts.filter(p => p.category === channel)
  // Publicar en el canal activo; en "Todos" cae a general.
  const postTarget = channel === 'all' ? 'general' : channel

  async function call(payload: Record<string, unknown>) {
    const res = await fetch('/api/foro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.ok
  }

  async function publish() {
    if (!body.trim() || posting) return
    setPosting(true)
    const ok = await call({ action: 'post', body, category: postTarget })
    setPosting(false)
    if (ok) { setBody(''); router.refresh() }
  }

  async function like(id: string) {
    if (await call({ action: 'like', post_id: id })) router.refresh()
  }

  function toggleComments(id: string) {
    setOpenComments(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Canales (desktop) */}
      <aside className="hidden md:block w-56 shrink-0 sticky top-24">
        <p className="section-label mb-2 px-2">Canales</p>
        <nav className="space-y-0.5">
          {CHANNELS.map(c => {
            const active = channel === c.value
            const Icon = c.icon
            return (
              <button
                key={c.value}
                onClick={() => setChannel(c.value)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-brand-600/15 text-brand-300' : 'text-cream-muted hover:text-cream hover:bg-surface-850'
                )}
              >
                <Icon size={16} className={active ? 'text-brand-400' : ''} />
                <span className="flex-1 text-left truncate">{c.label}</span>
                {(counts[c.value] ?? 0) > 0 && (
                  <span className="text-xs text-cream-dim">{counts[c.value]}</span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Feed */}
      <div className="flex-1 min-w-0">
        {/* Canales (mobile) */}
        <div className="md:hidden flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          {CHANNELS.map(c => (
            <button
              key={c.value}
              onClick={() => setChannel(c.value)}
              className={clsx(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                channel === c.value
                  ? 'bg-brand-600/15 text-brand-300 border-brand-600/30'
                  : 'bg-surface-850 text-cream-muted border-surface-700'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Composer — fondo claro a propósito, para que se note que estás escribiendo (pedido de
            Diana, 2026-07-03). brand-50 en vez de blanco puro (más tenue, ya es parte de la
            paleta) + botón en accent (naranja sólido) en vez del terracota apagado de btn-primary,
            que se veía muy opaco sobre fondo claro. */}
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50 overflow-hidden mb-6 focus-within:border-accent/60 transition-colors">
          <div className="flex items-start gap-3 p-4">
            <span className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
              <PenLine size={15} className="text-white" />
            </span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="¿En qué estás pensando?"
              rows={3}
              className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-brand-950 placeholder:text-brand-500/70 resize-none pt-1.5"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-brand-200/60 bg-brand-100/60">
            <span className="text-xs text-brand-700">
              Publicando en <span className="text-brand-800 font-medium">{channelLabel(postTarget)}</span>
            </span>
            <button
              onClick={publish}
              disabled={!body.trim() || posting}
              className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2.5 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-2 disabled:opacity-40"
            >
              {posting ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>

        {/* Posts */}
        {visible.length === 0 ? (
          <div className="card text-center py-12">
            <MessageCircle size={26} className="text-cream-muted mx-auto mb-3" />
            <p className="text-cream font-medium">{channel === 'all' ? 'Aún no hay publicaciones' : `Nada en ${channelLabel(channel)}`}</p>
            <p className="text-sm text-cream-muted mt-1">Sé el primero en compartir algo con la comunidad.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(p => {
              const isOpen = openComments.has(p.id)
              return (
                <div key={p.id} className="rounded-2xl border border-surface-700 bg-surface-850 p-4 hover:border-surface-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <Avatar name={p.author} url={p.authorAvatar} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-cream">{p.author}</p>
                        <span className="text-xs text-cream-muted">
                          {when(p.createdAt)} · en <span className={clsx('px-1.5 py-0.5 rounded-full text-[11px] font-medium', catStyle(p.category))}>{channelLabel(p.category)}</span>
                        </span>
                      </div>
                      <p className="text-sm text-cream-dim whitespace-pre-wrap mt-2 leading-relaxed">{p.body}</p>

                      <div className="flex items-center gap-1 mt-3 -ml-2">
                        <button
                          onClick={() => like(p.id)}
                          className={clsx(
                            'inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors',
                            p.likedByMe ? 'text-brand-400 hover:bg-brand-600/10' : 'text-cream-muted hover:text-cream hover:bg-surface-800'
                          )}
                        >
                          <Heart size={14} fill={p.likedByMe ? 'currentColor' : 'none'} /> {p.likeCount || 'Me gusta'}
                        </button>
                        <button
                          onClick={() => toggleComments(p.id)}
                          className={clsx(
                            'inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors',
                            isOpen ? 'text-cream bg-surface-800' : 'text-cream-muted hover:text-cream hover:bg-surface-800'
                          )}
                        >
                          <MessageCircle size={14} /> {p.comments.length || 'Comentar'}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-4 pt-4 border-t border-surface-700 space-y-3">
                          {p.comments.map(c => (
                            <div key={c.id} className="flex items-start gap-2.5">
                              <Avatar name={c.author} url={c.authorAvatar} size={28} />
                              <div className="min-w-0 flex-1 bg-surface-800 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium text-cream">{c.author}</p>
                                  <span className="text-[10px] text-cream-muted">{when(c.createdAt)}</span>
                                </div>
                                <p className="text-sm text-cream-dim whitespace-pre-wrap mt-0.5">{c.body}</p>
                              </div>
                            </div>
                          ))}
                          <CommentBox postId={p.id} onDone={() => router.refresh()} call={call} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Comunidad (derecha) */}
      <aside className="hidden xl:block w-72 shrink-0 sticky top-24">
        <div className="rounded-2xl border border-surface-700 bg-surface-850 overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-sand via-accent to-brand-600 flex items-center justify-center">
            <Image src="/logo-horizontal.png" alt={community.name} width={150} height={40} className="object-contain" />
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-cream">{community.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-cream-muted mt-0.5">
              <Lock size={11} /> Grupo privado
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-surface-700 text-center">
              <div>
                <p className="text-lg font-semibold text-cream">{community.memberCount}</p>
                <p className="text-xs text-cream-muted">Miembros</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-cream">{posts.length}</p>
                <p className="text-xs text-cream-muted">Publicaciones</p>
              </div>
            </div>
            {community.avatars.length > 0 && (
              <div className="flex items-center -space-x-2 mt-4">
                {community.avatars.map(a => (
                  <span key={a.id} className="w-8 h-8 rounded-full overflow-hidden bg-brand-700/50 border-2 border-surface-850 flex items-center justify-center" title={a.name}>
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatarUrl} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-semibold text-brand-300">{initials(a.name)}</span>
                    )}
                  </span>
                ))}
                {community.memberCount > community.avatars.length && (
                  <span className="w-8 h-8 rounded-full bg-surface-800 border-2 border-surface-850 flex items-center justify-center text-[10px] text-cream-muted">
                    +{community.memberCount - community.avatars.length}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function CommentBox({ postId, onDone, call }: { postId: string; onDone: () => void; call: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const ok = await call({ action: 'comment', post_id: postId, body: text })
    setSending(false)
    if (ok) { setText(''); onDone() }
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') send() }}
        placeholder="Escribe un comentario…"
        className="input flex-1"
      />
      <button onClick={send} disabled={!text.trim() || sending} className="btn-primary p-2.5 disabled:opacity-40" aria-label="Comentar">
        <Send size={15} />
      </button>
    </div>
  )
}
