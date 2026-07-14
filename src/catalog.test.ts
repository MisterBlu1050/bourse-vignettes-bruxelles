import { describe, expect, it } from 'vitest'
import { allStickerCodes, isStickerCode, stickerGroups } from './catalog'

describe('catalogue des vignettes', () => {
  it('contient exactement les 992 codes fournis, sans ordinal', () => {
    expect(allStickerCodes).toHaveLength(992)
    expect(new Set(allStickerCodes).size).toBe(992)
    expect(allStickerCodes[0]).toBe('00')
    expect(allStickerCodes.at(-1)).toBe('CC12')
  })

  it('regroupe les codes officiels, les 48 pays et la collection spéciale', () => {
    expect(stickerGroups).toHaveLength(50)
    expect(isStickerCode('FWC 19')).toBe(true)
    expect(isStickerCode('MEX 20')).toBe(true)
    expect(isStickerCode('HAI 20')).toBe(true)
    expect(isStickerCode('PAN 20')).toBe(true)
    expect(isStickerCode('CC12')).toBe(true)
    expect(isStickerCode('CC13')).toBe(false)
    expect(isStickerCode('1')).toBe(false)
  })
})
