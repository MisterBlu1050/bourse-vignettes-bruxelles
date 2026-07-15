export type View = 'inventaire' | 'matches' | 'echanges' | 'securite'

export interface Inventory {
  doubles: string[]
  wanted: string[]
}

export interface Match {
  id: string
  adultAlias: string
  commune: string
  gives: string[]
  receives: string[]
  reliability: number
  exchanges: number
}

export interface Venue {
  id: string
  name: string
  commune: string
  note: string
}

export type ExchangeStatus = 'propose' | 'confirme' | 'termine' | 'annule'

export interface Exchange {
  id: string
  match: Match
  venue: Venue
  date: string
  slot: string
  status: ExchangeStatus
  code: string
  canConfirm?: boolean
}

export interface MatchNotification {
  id: string
  adultAlias: string
  commune: string
  gives: string[]
  receives: string[]
  createdAt: string
}
