import { Sprite } from './Fish'

// Les visiteurs du carnet en pixel art : un caractère par pixel, « . » = vide, k = œil
const K = '#1B1B3A'

export const VISITOR_SPRITES: Record<string, { rows: string[]; colors: Record<string, string> }> = {
  bernard: {
    rows: [
      '....sss.....',
      '...sdssss...',
      '..ssdsddss..',
      '..sdssssds..',
      '.rrsssdsss..',
      'rkrrsssss...',
      '.rrrrrr.....',
      'r.r.r.r.....',
    ],
    colors: { s: '#F2C66D', d: '#C9963F', r: '#E0304E', k: K },
  },
  gobie: {
    rows: [
      'f..bbbb...',
      'ffbdbbdbb.',
      'fbbbbbbbkb',
      'ffbbdbbbb.',
      'f..bbbb...',
    ],
    colors: { b: '#C9A66B', d: '#7A5C2E', f: '#A8844A', k: K },
  },
  chirurgien: {
    rows: [
      '...bbbbb....',
      '..bbnnnbbb..',
      'yybbbbnnbbb.',
      'yyybbbbbbkbb',
      'yybbbnnbbbb.',
      '..bbbbbbbb..',
      '...bbbbb....',
    ],
    colors: { b: '#3F7DE8', n: '#1B2A6B', y: '#F2C66D', k: K },
  },
  papillon: {
    rows: [
      '....yyy...',
      '...yyyyy..',
      'f.yyyynyy.',
      'ffyyyynkyy',
      'ffyyyynyy.',
      'f.yyyyyy..',
      '...yyyy...',
      '....yy....',
    ],
    colors: { y: '#FFD23F', n: '#1B1B3A', f: '#F2A03D', k: '#FFFFFF' },
  },
  ange: {
    rows: [
      '....p.....',
      '...pp.....',
      '..pppp....',
      '.pspppp...',
      'ppsppkpp..',
      '.pspppppp.',
      '..pppp....',
      '...pp.....',
      '....p.....',
    ],
    colors: { p: '#9B6BDF', s: '#F2C66D', k: K },
  },
  meduse: {
    rows: [
      '...mmmm...',
      '..mhmmmm..',
      '.mmmmmmmm.',
      '.mmmmmmmm.',
      '.m.m..m.m.',
      '.m.m..m.m.',
      '..m.mm.m..',
      '..m..m..m.',
      '.....m....',
    ],
    colors: { m: '#FF9CC8', h: '#FFFFFF' },
  },
  lion: {
    rows: [
      '.r.w.r.w....',
      '.r.w.r.w....',
      '..rwrwrwrr..',
      'frwrwrwrwkr.',
      'ffwrwrwrwrrr',
      'frwrwrwrwrr.',
      '..rwrwr.....',
      '.r.w.r......',
    ],
    colors: { r: '#E0304E', w: '#FFE9D6', f: '#F27A8E', k: K },
  },
  calamar: {
    rows: [
      'cc..........',
      'cccccccc....',
      'ccccccckcttt',
      'ccccccccc.t.',
      'cccccccc.t.t',
      'cc..........',
    ],
    colors: { c: '#F27A8E', t: '#E0566E', k: K },
  },
  nudibranche: {
    rows: [
      '.o..o..o..o.',
      '.p..p..p..p.',
      'pppppppppppp',
      'pwpwpwpwpwpp',
      '.pppppppppp.',
    ],
    colors: { p: '#7A4FD8', o: '#FF8C1A', w: '#FFFFFF' },
  },
  globe: {
    rows: [
      '..s.s.s...',
      '.yyyyyys..',
      's.yyyyyyy.',
      '.yyykwyyys',
      'syyyyyyyyy',
      '.yyllllyys',
      's.yllllyy.',
      '.yyyyyys..',
      '..s.s.s...',
    ],
    colors: { y: '#F2C66D', l: '#FFF1C9', s: '#B8860B', w: '#FFFFFF', k: K },
  },
  murene: {
    rows: [
      '...........ggg..',
      'gg......ggggggkg',
      '.gggggggggggggg.',
      '...gggggggg..www',
    ],
    colors: { g: '#5E8C3A', w: '#FFFFFF', k: K },
  },
  seiche: {
    rows: [
      '.wwwwwwww...',
      'wbbbbbbbbw..',
      'wbdbdbdbbbkt',
      'wbbbbbbbbbtt',
      'wbdbdbdbbw.t',
      '.wwwwwwww...',
    ],
    colors: { b: '#C9A66B', d: '#8B5A2B', w: '#FFE9D6', t: '#B8860B', k: K },
  },
  espadon: {
    rows: [
      '.....d............',
      'f...ddd...........',
      'ff.bbbbbbbbb......',
      '.fbbbbbbbbkbbbbbbb',
      'ff.llllllllb......',
      'f.................',
    ],
    colors: { b: '#4D6E9E', l: '#CFE1FB', d: '#2B4A73', f: '#2B4A73', k: K },
  },
  lune: {
    rows: [
      '....d.....',
      '...dd.....',
      '.gggggg...',
      'gggggggg..',
      'gggggkggg.',
      'gglggggggd',
      'gggglgggg.',
      '.gggggg...',
      '...dd.....',
      '....d.....',
    ],
    colors: { g: '#A7B1C2', l: '#CFD6E0', d: '#6B6E80', k: K },
  },
  sardines: {
    rows: [
      '.........s.bbbb.',
      '.........ssssks.',
      '.........s.llll.',
      '................',
      's.bbbb..........',
      'ssssks..........',
      's.llll..........',
      '................',
      '......s.bbbb....',
      '......ssssks....',
      '......s.llll....',
    ],
    colors: { b: '#4D6E9E', s: '#9FB3CC', l: '#E6ECF4', k: K },
  },
  clowns: {
    rows: [
      '...oooo.........',
      'f.owoowo........',
      'ffowoowok.......',
      'f.owoowo........',
      '...oooo.........',
      '................',
      '.........oooo...',
      '......f.owoowo..',
      '......ffowoowok.',
      '......f.owoowo..',
      '.........oooo...',
    ],
    colors: { o: '#FF8C1A', w: '#FFFFFF', f: '#E06A10', k: K },
  },
  hippocampes: {
    rows: [
      '.hh......hh.',
      'hkhh....hhkh',
      '..hhh..hhh..',
      '..hh....hh..',
      '.hhh....hhh.',
      '.hhh....hhh.',
      '..hh....hh..',
      '...h....h...',
      '..hh....hh..',
      '..h......h..',
    ],
    colors: { h: '#F2A03D', k: K },
  },
  tortue: {
    rows: [
      '..s......s....',
      '.ss......ss...',
      '..gggggggg....',
      '.ggdgdgdggg.ss',
      'ggdgdgdgdggskk',
      '.ggdgdgdggg.ss',
      '..gggggggg....',
      '.ss......ss...',
      '..s......s....',
    ],
    colors: { g: '#5E8C3A', d: '#8BBF5A', s: '#9CC59A', k: K },
  },
  dauphin: {
    rows: [
      '.......d........',
      '......dd........',
      '...bbbbbbbbb....',
      '.bbbbbbbbbbbkbbb',
      'b..lllllllllll..',
      'bb..............',
      'b...............',
    ],
    colors: { b: '#7F9CC2', l: '#DCE6F2', d: '#5E7BA3', k: K },
  },
  perroquets: {
    rows: [
      '...ggggg....',
      '..gpgpgpgg..',
      'ttgggggggkyy',
      'tgpgpgpgggyy',
      'ttgggggggg..',
      '..ggggggg...',
      '....gg......',
    ],
    colors: { g: '#2EC4B6', p: '#FF6FAE', t: '#1E9E8A', y: '#F2C66D', k: K },
  },
  manta: {
    rows: [
      '.......kk.......',
      '......mmmm......',
      '....mmmmmmmm....',
      '..mmmmmmmmmmmm..',
      'mmmmmmwmmwmmmmmm',
      '..mmmmmmmmmmmm..',
      '......mmmm......',
      '.......mm.......',
      '........m.......',
    ],
    colors: { m: '#2B2D5C', w: '#8C8FC9', k: K },
  },
  requin: {
    rows: [
      '........d.........',
      '.......ddd........',
      'f..bbbbbbbbbbbb...',
      'ffbbsbbsbbsbbbkbb.',
      'f..bbsbbsbbsbbbbbb',
      '....lllllllllll...',
    ],
    colors: { b: '#C9B48A', s: '#5A4632', l: '#F0E6D2', d: '#A8916A', f: '#A8916A', k: K },
  },
  baleine: {
    rows: [
      '...............w.w..',
      '................w...',
      '......bbbbbbbbbb....',
      '...bbbbbbbbbbbbbbb..',
      'b.bbbbbbbbbbbbbkbbb.',
      'bbbbbbbbbbbbbbbbbbbb',
      'b.bbllllllllllllbbb.',
      '....lllllllllllll...',
      '.......bb...........',
    ],
    colors: { b: '#3F6FB5', l: '#CFE1FB', w: '#8DD3FF', k: K },
  },
}

/** Un visiteur, en couleur ou en silhouette s'il n'est pas encore trouvé */
export function VisitorSprite({ id, px = 3, max = 60, silhouette = false, label }: {
  id: string
  /** Taille d'un pixel du dessin, pour que tous les visiteurs gardent la même échelle */
  px?: number
  /** Largeur maximale (les plus grands visiteurs rétrécissent un peu) */
  max?: number
  silhouette?: boolean
  label?: string
}) {
  const s = VISITOR_SPRITES[id]
  if (!s) return null
  const width = Math.min(max, s.rows[0].length * px)
  const colors = silhouette ? Object.fromEntries(Object.keys(s.colors).map((c) => [c, 'rgba(27, 27, 58, 0.22)'])) : s.colors
  return <Sprite rows={s.rows} colors={colors} width={width} label={label} />
}
