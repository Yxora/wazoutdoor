// Edge Function Supabase : supprime le compte de la personne qui appelle (droit à l'effacement).
// La clé service_role reste ici : Supabase la fournit aux fonctions (SUPABASE_SERVICE_ROLE_KEY), jamais au front.
// La base fait le reste : préférences et votes « plus là » supprimés (on delete cascade),
// signalements gardés sans lien avec le compte (on delete set null). Les photos restent avec leurs signalements.
// Déploiement : supabase functions deploy delete-account

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'function not configured' }, 500)

  // Le compte à supprimer est celui du jeton, jamais un identifiant envoyé par le navigateur
  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'not signed in' }, 401)
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } })
  if (!userResponse.ok) return json({ error: 'not signed in' }, 401)
  const user = await userResponse.json().catch(() => ({}))
  if (typeof user.id !== 'string') return json({ error: 'not signed in' }, 401)

  const deleted = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!deleted.ok) {
    console.error(`delete-account : suppression refusée (HTTP ${deleted.status}) ${await deleted.text().catch(() => '')}`)
    return json({ error: 'deletion failed' }, 502)
  }
  return json({ deleted: true })
})
