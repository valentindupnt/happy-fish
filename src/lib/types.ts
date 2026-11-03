export type FishColor = 'corail' | 'rose' | 'lagon' | 'ocean' | 'soleil' | 'amethyste' | 'cerise' | 'menthe' | 'nuit' | 'or'

export interface Profile {
  id: string
  email: string | null
  couple_id: string | null
  display_name: string
  partner_nickname: string | null
  fish_name: string
  fish_color: FishColor
  fish_hat: string | null
  fish_pet: string | null
  bowl_style: string
  notify_messages: boolean
  notify_gestures: boolean
  notify_checks: boolean
  notify_evening: boolean
  notify_weekly: boolean
}

export interface Couple {
  id: string
  invite_code: string
  aquarium_bought: boolean
}

export interface Category {
  id: string
  name: string
  color: string
  position: number
}

export interface Suggestion {
  id: string
  category_id: string | null
  title: string
  minutes: number
}

export interface Goal {
  id: string
  owner_id: string | null
  created_by: string
  title: string
  category_id: string | null
  minutes: number
  days: number[]
  recurring: boolean
  week_start: string
  note: string | null
  archived: boolean
}

export interface Task {
  id: string
  goal_id: string
  owner_id: string | null
  planned_date: string
  date: string
  note: string | null
  skipped: boolean
  done_at: string | null
  done_by: string | null
}

export interface Wish {
  id: string
  created_by: string
  title: string
  note: string | null
  link: string | null
  created_at: string
}

export interface Message {
  id: string
  author_id: string
  kind: 'text' | 'bubble' | 'treat'
  body: string | null
  task_id: string | null
  created_at: string
}

export interface ForceMessage {
  id: string
  body: string
  position: number
}

export interface FishStatus {
  profile_id: string
  xp: number
  level: number
  level_uncapped: number
  coins: number
}

export type ItemKind = 'color' | 'bowl' | 'hat' | 'pet' | 'decor'

export interface ShopItem {
  id: string
  kind: ItemKind
  name: string
  price: number
  min_level: number
  scope: 'perso' | 'commun'
  position: number
}

export interface Purchase {
  profile_id: string
  item_id: string
}

export interface CoupleItem {
  item_id: string
}

export interface Review {
  id: string
  profile_id: string
  week_start: string
  done: number
  missed: number
  xp: number
  surprise_due: boolean
  surprise_received_at: string | null
}
