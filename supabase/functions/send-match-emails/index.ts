import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type MatchNotification = {
  id: string
  user_id: string
  match_user_id: string
  match_gives: string[] | null
  match_receives: string[] | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('MATCH_EMAIL_FROM')
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://bourse-vignettes-bruxelles.pages.dev'

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase environment missing' }, 500)
  if (!resendApiKey || !emailFrom) return json({ sent: 0, skipped: 'email_provider_not_configured' })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: pending, error } = await admin
    .from('notifications')
    .select('id,user_id,match_user_id,match_gives,match_receives')
    .eq('kind', 'match')
    .is('emailed_at', null)
    .is('email_error', null)
    .order('created_at', { ascending: true })
    .limit(25)

  if (error) return json({ error: error.message }, 500)

  let sent = 0
  const failures: Array<{ id: string; error: string }> = []

  for (const notification of (pending ?? []) as MatchNotification[]) {
    const [{ data: recipientProfile }, { data: matchProfile }, { data: userResult }] = await Promise.all([
      admin.from('profiles').select('adult_alias,email_match_notifications').eq('id', notification.user_id).maybeSingle(),
      admin.from('profiles').select('adult_alias,commune').eq('id', notification.match_user_id).maybeSingle(),
      admin.auth.admin.getUserById(notification.user_id)
    ])

    if (!recipientProfile?.email_match_notifications) {
      await admin.from('notifications').update({ email_error: 'email_notifications_disabled' }).eq('id', notification.id)
      continue
    }

    const email = userResult.user?.email
    if (!email) {
      await admin.from('notifications').update({ email_error: 'recipient_email_missing' }).eq('id', notification.id)
      continue
    }

    const otherAlias = matchProfile?.adult_alias ?? 'un autre parent'
    const commune = matchProfile?.commune ? ` (${matchProfile.commune})` : ''
    const gives = (notification.match_gives ?? []).join(', ')
    const receives = (notification.match_receives ?? []).join(', ')
    const subject = 'Nouvelle correspondance de vignettes'
    const text = [
      `Bonjour,`,
      ``,
      `Bonne nouvelle : ${otherAlias}${commune} a des vignettes que vous recherchez, et recherche aussi des vignettes que vous avez en double.`,
      ``,
      `Vous pourriez recevoir : ${gives || 'à vérifier dans l’application'}`,
      `Vous pourriez donner : ${receives || 'à vérifier dans l’application'}`,
      ``,
      `Voir la correspondance : ${appUrl}/app`,
      ``,
      `Bourse aux vignettes Bruxelles est un service gratuit, sans publicité, entre parents/voisins.`
    ].join('\n')

    const html = text
      .split('\n')
      .map((line) => line ? `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : '<br>')
      .join('')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: emailFrom, to: email, subject, text, html })
    })

    if (response.ok) {
      sent += 1
      await admin.from('notifications').update({ emailed_at: new Date().toISOString(), email_error: null }).eq('id', notification.id)
    } else {
      const errorText = await response.text()
      const clipped = errorText.slice(0, 500)
      failures.push({ id: notification.id, error: clipped })
      await admin.from('notifications').update({ email_error: clipped }).eq('id', notification.id)
    }
  }

  return json({ sent, failures })
})
