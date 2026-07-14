export interface StickerGroup {
  id: string
  label: string
  country: string
  codes: string[]
}

const codes = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`)

export const stickerGroups: StickerGroup[] = [
  { id: 'official', label: 'Officiels', country: 'Collection', codes: ['00', ...codes('FWC', 19)] },
  { id: 'mex', label: 'Mexique', country: 'MEX', codes: codes('MEX', 20) },
  { id: 'rsa', label: 'Afrique du Sud', country: 'RSA', codes: codes('RSA', 20) },
  { id: 'kor', label: 'Corée du Sud', country: 'KOR', codes: codes('KOR', 20) },
  { id: 'cze', label: 'Tchéquie', country: 'CZE', codes: codes('CZE', 20) },
  { id: 'can', label: 'Canada', country: 'CAN', codes: codes('CAN', 20) },
  { id: 'bih', label: 'Bosnie-Herzégovine', country: 'BIH', codes: codes('BIH', 20) },
  { id: 'qat', label: 'Qatar', country: 'QAT', codes: codes('QAT', 20) },
  { id: 'sui', label: 'Suisse', country: 'SUI', codes: codes('SUI', 20) },
  { id: 'bra', label: 'Brésil', country: 'BRA', codes: codes('BRA', 20) },
  { id: 'mar', label: 'Maroc', country: 'MAR', codes: codes('MAR', 20) },
  { id: 'hai', label: 'Haïti', country: 'HAI', codes: codes('HAI', 20) },
  { id: 'sco', label: 'Écosse', country: 'SCO', codes: codes('SCO', 20) },
  { id: 'usa', label: 'États-Unis', country: 'USA', codes: codes('USA', 20) },
  { id: 'par', label: 'Paraguay', country: 'PAR', codes: codes('PAR', 20) },
  { id: 'aus', label: 'Australie', country: 'AUS', codes: codes('AUS', 20) },
  { id: 'tur', label: 'Turquie', country: 'TUR', codes: codes('TUR', 20) },
  { id: 'ger', label: 'Allemagne', country: 'GER', codes: codes('GER', 20) },
  { id: 'cuw', label: 'Curaçao', country: 'CUW', codes: codes('CUW', 20) },
  { id: 'civ', label: 'Côte d’Ivoire', country: 'CIV', codes: codes('CIV', 20) },
  { id: 'ecu', label: 'Équateur', country: 'ECU', codes: codes('ECU', 20) },
  { id: 'ned', label: 'Pays-Bas', country: 'NED', codes: codes('NED', 20) },
  { id: 'jpn', label: 'Japon', country: 'JPN', codes: codes('JPN', 20) },
  { id: 'swe', label: 'Suède', country: 'SWE', codes: codes('SWE', 20) },
  { id: 'tun', label: 'Tunisie', country: 'TUN', codes: codes('TUN', 20) },
  { id: 'bel', label: 'Belgique', country: 'BEL', codes: codes('BEL', 20) },
  { id: 'egy', label: 'Égypte', country: 'EGY', codes: codes('EGY', 20) },
  { id: 'irn', label: 'Iran', country: 'IRN', codes: codes('IRN', 20) },
  { id: 'nzl', label: 'Nouvelle-Zélande', country: 'NZL', codes: codes('NZL', 20) },
  { id: 'esp', label: 'Espagne', country: 'ESP', codes: codes('ESP', 20) },
  { id: 'cpv', label: 'Cap-Vert', country: 'CPV', codes: codes('CPV', 20) },
  { id: 'ksa', label: 'Arabie saoudite', country: 'KSA', codes: codes('KSA', 20) },
  { id: 'uru', label: 'Uruguay', country: 'URU', codes: codes('URU', 20) },
  { id: 'fra', label: 'France', country: 'FRA', codes: codes('FRA', 20) },
  { id: 'sen', label: 'Sénégal', country: 'SEN', codes: codes('SEN', 20) },
  { id: 'irq', label: 'Irak', country: 'IRQ', codes: codes('IRQ', 20) },
  { id: 'nor', label: 'Norvège', country: 'NOR', codes: codes('NOR', 20) },
  { id: 'arg', label: 'Argentine', country: 'ARG', codes: codes('ARG', 20) },
  { id: 'alg', label: 'Algérie', country: 'ALG', codes: codes('ALG', 20) },
  { id: 'aut', label: 'Autriche', country: 'AUT', codes: codes('AUT', 20) },
  { id: 'jor', label: 'Jordanie', country: 'JOR', codes: codes('JOR', 20) },
  { id: 'por', label: 'Portugal', country: 'POR', codes: codes('POR', 20) },
  { id: 'cod', label: 'RD Congo', country: 'COD', codes: codes('COD', 20) },
  { id: 'uzb', label: 'Ouzbékistan', country: 'UZB', codes: codes('UZB', 20) },
  { id: 'col', label: 'Colombie', country: 'COL', codes: codes('COL', 20) },
  { id: 'eng', label: 'Angleterre', country: 'ENG', codes: codes('ENG', 20) },
  { id: 'cro', label: 'Croatie', country: 'CRO', codes: codes('CRO', 20) },
  { id: 'gha', label: 'Ghana', country: 'GHA', codes: codes('GHA', 20) },
  { id: 'pan', label: 'Panama', country: 'PAN', codes: codes('PAN', 20) },
  { id: 'cc', label: 'Collection spéciale', country: 'CC', codes: Array.from({ length: 12 }, (_, index) => `CC${String(index + 1).padStart(2, '0')}`) }
]

export const allStickerCodes = stickerGroups.flatMap((group) => group.codes)
export const stickerCodeSet = new Set(allStickerCodes)
const catalogOrder = new Map(allStickerCodes.map((code, index) => [code, index]))

export const canonicalizeStickerCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, ' ')
export const isStickerCode = (value: string) => stickerCodeSet.has(canonicalizeStickerCode(value))
export const sortStickerCodes = (values: string[]) => [...values].sort((a, b) => (catalogOrder.get(a) ?? 9999) - (catalogOrder.get(b) ?? 9999))
