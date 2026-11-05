// Banque de GIFs des petits mots : fichiers dans public/gifs/<id>.gif (384 × 336, en boucle).
// Le message garde seulement l'id dans « body » ; la base vérifie sa forme (migration 010).

export interface GifDef { id: string; label: string }
export interface GifSeries { id: string; title: string; gifs: GifDef[] }

export const GIF_SERIES: GifSeries[] = [
  {
    id: 'memes',
    title: 'Les memes',
    gifs: [
      { id: 'ca-va-bien-se-passer', label: 'Ça va bien se passer' },
      { id: 'cest-pas-faux', label: 'C’est pas faux' },
      { id: 'bref', label: 'Bref.' },
      { id: 'pas-de-bras-pas-de-chocolat', label: 'Pas de bras, pas de chocolat' },
      { id: 'pas-venu-pour-souffrir', label: 'Je suis pas venu ici pour souffrir, ok ?' },
      { id: 'deal-with-it', label: 'Deal with it' },
      { id: 'stonks', label: 'Stonks' },
      { id: 'nope', label: 'Nope' },
      { id: 'on-est-pas-bien-la', label: 'On n’est pas bien là ?' },
      { id: 'ca-cest-fait', label: 'Ça, c’est fait.' },
      { id: 'jai-le-seum', label: 'J’ai le seum' },
      { id: 'sheesh', label: 'Sheeeesh' },
      { id: 'big-brain', label: 'Big brain' },
      { id: 'plot-twist', label: 'Plot twist' },
      { id: 'la-flemme', label: 'La flemme' },
      { id: 'mais-oui-cest-clair', label: 'Mais oui c’est clair' },
    ],
  },
  {
    id: 'rose',
    title: 'Téléphone rose',
    gifs: [
      { id: 'coucou-toi', label: 'Coucou toi' },
      { id: 'envoie-des-nudes', label: 'Envoie des nudes' },
      { id: 'bisous', label: 'Bisous' },
      { id: 'trop-canon', label: 'Trop canon' },
      { id: 'allo-cest-ton-poisson', label: 'Allô ? C’est ton poisson' },
      { id: 'my-jaw', label: 'Snap girl, you dropped something… my jaw' },
    ],
  },
]

export const GIFS: GifDef[] = GIF_SERIES.flatMap((s) => s.gifs)
const byId = new Map(GIFS.map((g) => [g.id, g]))

/** Même règle que la base : lettres minuscules, chiffres et tirets */
export const GIF_ID = /^[a-z0-9-]{1,40}$/

export const gifSrc = (id: string) => `/gifs/${id}.gif`
export const gifLabel = (id: string | null) => (id && byId.get(id)?.label) || 'GIF'
export const isKnownGif = (id: string | null) => !!id && byId.has(id)
