import type { Inventory, Match } from '../types'
import { canonicalizeStickerCode, isStickerCode, sortStickerCodes } from '../catalog'

type Collector = Match & { doubles: string[]; wanted: string[] }

const intersection = (a: string[], b: string[]) => sortStickerCodes([...new Set(a.filter((value) => b.includes(value)))])

export function findReciprocalMatches(inventory: Inventory, collectors: Collector[]): Match[] {
  return collectors
    .map((collector) => ({
      ...collector,
      gives: intersection(collector.doubles, inventory.wanted),
      receives: intersection(inventory.doubles, collector.wanted)
    }))
    .filter((match) => match.gives.length > 0 && match.receives.length > 0)
    .sort((a, b) => Math.min(b.gives.length, b.receives.length) - Math.min(a.gives.length, a.receives.length))
}

export function normalizeStickerIds(values: string[]): string[] {
  return sortStickerCodes([...new Set(values.map(canonicalizeStickerCode).filter(isStickerCode))])
}
