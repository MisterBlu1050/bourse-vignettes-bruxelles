import { describe, expect, it } from 'vitest'
import { findReciprocalMatches, normalizeStickerIds } from './matching'

describe('findReciprocalMatches', () => {
  it('ne conserve que les échanges réciproques', () => {
    const result = findReciprocalMatches(
      { doubles: ['MEX 1', 'RSA 2'], wanted: ['BRA 8', 'MAR 9'] },
      [
        { id: 'ok', adultAlias: 'A.', commune: 'Ixelles', reliability: 100, exchanges: 1, gives: [], receives: [], doubles: ['BRA 8'], wanted: ['RSA 2'] },
        { id: 'one-way', adultAlias: 'B.', commune: 'Jette', reliability: 100, exchanges: 1, gives: [], receives: [], doubles: ['MAR 9'], wanted: ['CAN 5'] }
      ]
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ok')
    expect(result[0].gives).toEqual(['BRA 8'])
    expect(result[0].receives).toEqual(['RSA 2'])
  })
})

describe('normalizeStickerIds', () => {
  it('normalise, déduplique et rejette les identifiants invalides', () => {
    expect(normalizeStickerIds(['bra 3', 'MEX 1', 'BRA   3', 'XYZ 1', 'FRA1', '12345'])).toEqual(['MEX 1', 'BRA 3'])
  })
})
