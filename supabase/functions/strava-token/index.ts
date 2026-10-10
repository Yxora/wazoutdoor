// Edge Function Supabase : échange un code d'autorisation Strava (ou un refresh_token) contre un jeton.
// Le secret client reste ici. Secrets à définir : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
// Déploiement : supabase functions deploy strava-token

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

  const clientId = Deno.env.get('STRAVA_CLIENT_ID')
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
  if (!clientId || !clientSecret) return json({ error: 'function not configured' }, 500)

  const { code, refresh_token } = await request.json().catch(() => ({}))
  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret })
  if (typeof code === 'string') {
    params.set('grant_type', 'authorization_code')
    params.set('code', code)
  } else if (typeof refresh_token === 'string') {
    params.set('grant_type', 'refresh_token')
    params.set('refresh_token', refresh_token)
  } else {
    return json({ error: 'code or refresh_token required' }, 400)
  }

  const strava = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body: params })
  const body = await strava.json().catch(() => ({}))
  if (!strava.ok) return json({ error: 'strava refused the request' }, strava.status)

  // On ne renvoie que ce dont le navigateur a besoin
  return json({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at,
    athlete: body.athlete ? { id: body.athlete.id } : undefined,
  })
})
