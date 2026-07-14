import type { Exchange, Inventory } from '../types'
import { normalizeStickerIds } from './matching'

const INVENTORY_KEY = 'bvb-inventory-v1'
const EXCHANGES_KEY = 'bvb-exchanges-v1'
const ONBOARDING_KEY = 'bvb-parent-confirmed-v1'

const read = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

export const storage = {
  getInventory: (): Inventory => {
    const saved = read<Inventory>(INVENTORY_KEY, { doubles: [], wanted: [] })
    const migrated = { doubles: normalizeStickerIds(saved.doubles ?? []), wanted: normalizeStickerIds(saved.wanted ?? []) }
    return migrated.doubles.length || migrated.wanted.length ? migrated : {
      doubles: ['MEX 2','RSA 7','KOR 15','CZE 6','CAN 8','BIH 1','QAT 4','SUI 10'],
      wanted: ['MEX 3','RSA 8','KOR 12','CZE 18','CAN 20','BIH 11','QAT 14','SUI 19','BRA 8','MAR 9']
    }
  },
  setInventory: (value: Inventory) => localStorage.setItem(INVENTORY_KEY, JSON.stringify(value)),
  getExchanges: (): Exchange[] => read(EXCHANGES_KEY, []),
  setExchanges: (value: Exchange[]) => localStorage.setItem(EXCHANGES_KEY, JSON.stringify(value)),
  isConfirmedAdult: () => localStorage.getItem(ONBOARDING_KEY) === 'true',
  confirmAdult: () => localStorage.setItem(ONBOARDING_KEY, 'true'),
  clear: () => {
    localStorage.removeItem(INVENTORY_KEY)
    localStorage.removeItem(EXCHANGES_KEY)
    localStorage.removeItem(ONBOARDING_KEY)
  }
}
