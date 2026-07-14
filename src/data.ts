import type { Match, Venue } from './types'

export const collection = {
  id: 'mondial-2026',
  title: 'Mondial 2026',
  edition: 'Édition internationale',
  total: 992
}

export const venues: Venue[] = [
  { id: 'muntpunt', name: 'Bibliothèque Muntpunt', commune: 'Bruxelles-Ville', note: 'À l’intérieur, pendant les heures d’ouverture' },
  { id: 'ixelles', name: 'Bibliothèque Sans Souci', commune: 'Ixelles', note: 'Hall d’accueil, pendant les heures d’ouverture' },
  { id: 'schaerbeek', name: 'Bibliothèque Sésame', commune: 'Schaerbeek', note: 'Espace d’accueil public' },
  { id: 'etterbeek', name: 'Maison communale', commune: 'Etterbeek', note: 'Hall public, en journée' },
  { id: 'forest', name: 'Bibliothèque de Forest', commune: 'Forest', note: 'À l’intérieur, pendant les heures d’ouverture' },
  { id: 'jette', name: 'Bibliothèque francophone', commune: 'Jette', note: 'Espace public d’accueil' }
]

export const demoCollectors: Array<Match & { doubles: string[]; wanted: string[] }> = [
  { id: 'm1', adultAlias: 'Nora B.', commune: 'Ixelles', gives: [], receives: [], reliability: 100, exchanges: 8, doubles: ['MEX 3','RSA 8','KOR 12','CZE 18','CAN 20','BIH 11','QAT 14','SUI 19','BRA 8','MAR 9'], wanted: ['MEX 2','RSA 7','KOR 15','CZE 6','CAN 8','BIH 1','QAT 4','SUI 10'] },
  { id: 'm2', adultAlias: 'Yann D.', commune: 'Schaerbeek', gives: [], receives: [], reliability: 96, exchanges: 5, doubles: ['MEX 2','RSA 9','KOR 15','CZE 16','CAN 17','BIH 5','QAT 3','SUI 8'], wanted: ['MEX 3','RSA 8','CZE 18','BRA 8'] },
  { id: 'm3', adultAlias: 'Samira K.', commune: 'Forest', gives: [], receives: [], reliability: 100, exchanges: 3, doubles: ['RSA 7','KOR 11','CZE 19','CAN 8','BIH 6','QAT 4','SUI 17','MAR 9'], wanted: ['KOR 12','CAN 20','BIH 11','SUI 19'] },
  { id: 'm4', adultAlias: 'Thomas V.', commune: 'Jette', gives: [], receives: [], reliability: 92, exchanges: 11, doubles: ['MEX 5','RSA 10','KOR 20','CZE 6','CAN 18','BIH 12','QAT 7','SUI 10'], wanted: ['MEX 2','MEX 3','RSA 8','KOR 12'] }
]
