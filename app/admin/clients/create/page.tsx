import { createClient } from '@/lib/supabase/server'
import CreateClientForm from './CreateClientForm'

export default async function CreateClientPage() {
  const supabase = await createClient()
  const { data: products } = await supabase.from('products').select('slug, title').order('title')
  return <CreateClientForm products={(products ?? []) as { slug: string; title: string }[]} />
}
