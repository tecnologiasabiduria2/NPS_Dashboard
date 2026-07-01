'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, MessageCircle, Send } from 'lucide-react'
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

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'anuncios', label: 'Anuncios' },
  { value: 'presentaciones', label: 'Presentaciones' },
  { value: 'networking', label: 'Networking' },
  { value: 'soporte', label: 'Soporte' },
]
const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? 'General'

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
function when(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

export default function Foro({ posts }: { posts: ForoPost[] }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [posting, setPosting] = useState(false)
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())

  async function call(payload: Record<string, unknown>) {
    const res = await fetch('/api/foro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.ok
  }

  async function publish() {
    if (!body.trim() || posting) return
    setPosting(true)
    const ok = await call({ action: 'post', body, category })
    setPosting(false)
    if (ok) { setBody(''); setCategory('general'); router.refresh() }
  }

  async function like(id: string) {
    if (await call({ action: 'like', post_id: id })) router.refresh()
  }

  function toggleComments(id: string) {
    setOpenComments(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div>
      {/* Composer */}
      <div className="card mb-6">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="¿En qué estás pensando?"
          rows={3}
          className="input resize-none"
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <select value={category} onChange={e => setCategory(e.target.value)} className="select w-auto text-sm">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button onClick={publish} disabled={!body.trim() || posting} className="btn-primary disabled:opacity-40">
            {posting ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="card text-center py-12">
          <MessageCircle size={26} className="text-cream-muted mx-auto mb-3" />
          <p className="text-cream font-medium">Aún no hay publicaciones</p>
          <p className="text-sm text-cream-muted mt-1">Sé el primero en compartir algo con la comunidad.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start gap-3">
                <Avatar name={p.author} url={p.authorAvatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-cream">{p.author}</p>
                    <span className="badge-brand">{catLabel(p.category)}</span>
                    <span className="text-xs text-cream-muted">{when(p.createdAt)}</span>
                  </div>
                  <p className="text-sm text-cream-dim whitespace-pre-wrap mt-2">{p.body}</p>

                  <div className="flex items-center gap-4 mt-3">
                    <button onClick={() => like(p.id)} className={clsx('inline-flex items-center gap-1.5 text-xs transition-colors', p.likedByMe ? 'text-brand-400' : 'text-cream-muted hover:text-cream')}>
                      <Heart size={14} fill={p.likedByMe ? 'currentColor' : 'none'} /> {p.likeCount}
                    </button>
                    <button onClick={() => toggleComments(p.id)} className="inline-flex items-center gap-1.5 text-xs text-cream-muted hover:text-cream transition-colors">
                      <MessageCircle size={14} /> {p.comments.length}
                    </button>
                  </div>

                  {openComments.has(p.id) && (
                    <div className="mt-4 pt-4 border-t border-surface-700 space-y-3">
                      {p.comments.map(c => (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar name={c.author} url={c.authorAvatar} size={28} />
                          <div className="min-w-0 flex-1 bg-surface-800 rounded-lg px-3 py-2">
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
          ))}
        </div>
      )}
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
