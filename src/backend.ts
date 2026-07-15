import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Exchange, ExchangeStatus, Inventory, Match, MatchNotification, Venue } from './types'

export interface ParentProfile {
  id: string
  adult_alias: string
  commune: string
  is_adult_confirmed: boolean
  match_notifications_enabled: boolean
}

export interface BackendWorkspace {
  collectionId: string
  inventory: Inventory
  matches: Match[]
  exchanges: Exchange[]
  matchNotifications: MatchNotification[]
  venues: Venue[]
}

const requireClient = () => {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await requireClient().auth.getUser()
  if (error) throw error
  return data.user
}

export async function getProfile(userId: string): Promise<ParentProfile | null> {
  const { data, error } = await requireClient().from('profiles').select('id,adult_alias,commune,is_adult_confirmed,email_match_notifications').eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, adult_alias: data.adult_alias, commune: data.commune, is_adult_confirmed: data.is_adult_confirmed, match_notifications_enabled: data.email_match_notifications } : null
}

export async function createProfile(userId: string, alias: string, commune: string): Promise<ParentProfile> {
  const { data, error } = await requireClient().from('profiles').insert({ id: userId, adult_alias: alias, commune, is_adult_confirmed: true }).select('id,adult_alias,commune,is_adult_confirmed,email_match_notifications').single()
  if (error) throw error
  return { id: data.id, adult_alias: data.adult_alias, commune: data.commune, is_adult_confirmed: data.is_adult_confirmed, match_notifications_enabled: data.email_match_notifications }
}

export async function updateMatchNotifications(userId: string, enabled: boolean): Promise<ParentProfile> {
  const { data, error } = await requireClient()
    .from('profiles')
    .update({ email_match_notifications: enabled })
    .eq('id', userId)
    .select('id,adult_alias,commune,is_adult_confirmed,email_match_notifications')
    .single()
  if (error) throw error
  return { id: data.id, adult_alias: data.adult_alias, commune: data.commune, is_adult_confirmed: data.is_adult_confirmed, match_notifications_enabled: data.email_match_notifications }
}

const mapExchangeStatus = (status: string): ExchangeStatus => ({ proposed: 'propose', confirmed: 'confirme', completed: 'termine', cancelled: 'annule', expired: 'annule' })[status] as ExchangeStatus

export async function loadWorkspace(): Promise<BackendWorkspace> {
  const client = requireClient()
  const { data: activeCollection, error: collectionError } = await client.from('collections').select('id').eq('active', true).single()
  if (collectionError) throw collectionError
  const collectionId = activeCollection.id as string

  const [inventoryResult, matchesResult, exchangesResult, notificationsResult, venuesResult] = await Promise.all([
    client.from('inventory').select('sticker_id,kind').eq('collection_id', collectionId),
    client.rpc('find_matches', { target_collection: collectionId }),
    client.rpc('list_my_exchanges'),
    client.rpc('list_my_match_notifications'),
    client.from('venues').select('id,name,commune,public_note').eq('approved', true).order('name')
  ])
  for (const result of [inventoryResult, matchesResult, exchangesResult, notificationsResult, venuesResult]) if (result.error) throw result.error

  const inventoryRows = inventoryResult.data ?? []
  const matches: Match[] = (matchesResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.user_id), adultAlias: String(row.adult_alias), commune: String(row.commune),
    gives: row.gives as string[], receives: row.receives as string[], reliability: 100,
    exchanges: Number(row.successful_exchanges)
  }))
  const exchanges: Exchange[] = (exchangesResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    match: { id: String(row.other_user_id), adultAlias: String(row.other_alias), commune: String(row.other_commune), gives: row.i_receive as string[], receives: row.i_give as string[], reliability: 100, exchanges: Number(row.other_exchanges) },
    venue: { id: String(row.venue_id), name: String(row.venue_name), commune: String(row.venue_commune), note: String(row.venue_note) },
    date: String(row.meeting_date), slot: String(row.meeting_slot), status: mapExchangeStatus(String(row.status)), code: String(row.meeting_code), canConfirm: Boolean(row.can_confirm),
    myPhone: row.my_phone ? String(row.my_phone) : undefined,
    otherPhone: row.other_phone ? String(row.other_phone) : undefined,
    phonesVisible: Boolean(row.phones_visible)
  }))
  const approvedVenues: Venue[] = (venuesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, commune: row.commune, note: row.public_note }))
  const matchNotifications: MatchNotification[] = (notificationsResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    adultAlias: String(row.other_alias),
    commune: String(row.other_commune),
    gives: row.i_receive as string[],
    receives: row.i_give as string[],
    createdAt: String(row.created_at)
  }))

  return {
    collectionId,
    inventory: {
      doubles: inventoryRows.filter((row) => row.kind === 'double').map((row) => row.sticker_id),
      wanted: inventoryRows.filter((row) => row.kind === 'wanted').map((row) => row.sticker_id)
    },
    matches, exchanges, matchNotifications, venues: approvedVenues
  }
}

export async function saveInventory(collectionId: string, inventory: Inventory) {
  const client = requireClient()
  const user = await getCurrentUser()
  if (!user) throw new Error('Session expirée')
  const { error: deleteError } = await client.from('inventory').delete().eq('collection_id', collectionId).eq('user_id', user.id)
  if (deleteError) throw deleteError
  const rows = [
    ...inventory.doubles.map((sticker_id) => ({ user_id: user.id, collection_id: collectionId, sticker_id, kind: 'double' })),
    ...inventory.wanted.map((sticker_id) => ({ user_id: user.id, collection_id: collectionId, sticker_id, kind: 'wanted' }))
  ]
  if (rows.length) {
    const { error } = await client.from('inventory').insert(rows)
    if (error) throw error
  }
  const { error: notifyError } = await client.rpc('queue_match_notifications', { target_collection: collectionId })
  if (notifyError) console.warn('Notifications de matching non créées', notifyError)
}

export async function markMatchNotificationsRead() {
  const { error } = await requireClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('kind', 'match')
    .is('read_at', null)
  if (error) throw error
}

export async function proposeBackendExchange(collectionId: string, match: Match, venue: Venue, date: string, slot: string, phone: string) {
  const { error } = await requireClient().rpc('propose_exchange', {
    target_collection: collectionId, target_recipient: match.id, target_venue: venue.id,
    target_date: date, target_slot: slot, my_stickers: match.receives, their_stickers: match.gives,
    proposer_phone_input: phone
  })
  if (error) throw error
}

export async function confirmBackendExchange(id: string, phone: string) {
  const { error } = await requireClient().rpc('confirm_exchange', { exchange_to_confirm: id, recipient_phone_input: phone })
  if (error) throw error
}

export async function setBackendExchangeStatus(id: string, status: 'cancelled' | 'completed') {
  const { error } = await requireClient().rpc('set_exchange_status', { target_exchange: id, target_status: status })
  if (error) throw error
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}

export async function deleteAccount() {
  const { error } = await requireClient().rpc('delete_my_account')
  if (error) throw error
}
