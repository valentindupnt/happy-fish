// Tests de la modification d'un objectif en cours et de la limite de reports (migration 015)
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let xpOf: Awaited<ReturnType<typeof createDb>>['xpOf']
let today: Awaited<ReturnType<typeof createDb>>['today']

const ALL = 'array[1,2,3,4,5,6,7]'

async function dow(): Promise<number> {
  return (await admin<{ n: number }>(`select extract(isodow from public.today_paris())::int as n`))[0].n
}
async function goal(user: string, title: string, days: string, recurring = true, common = false): Promise<string> {
  const d = await today()
  const rows = await as<{ id: string }>(user,
    `select public.create_goal($1, 15, ${days}, $2, $3::date, null, null, $4) as id`, [title, recurring, d, common])
  return rows[0].id
}
const tasksOf = (g: string) => admin<{ id: string; date: string; planned_date: string; postponed: number; done_at: string | null; skipped: boolean }>(
  `select id, date::text, planned_date::text, postponed, done_at::text, skipped from public.tasks where goal_id = $1 order by planned_date`, [g])
const todayTask = async (g: string) => (await admin<{ id: string }>(`select id from public.tasks where goal_id = $1 and planned_date = public.today_paris()`, [g]))[0].id

describe('Happy Fish, modifier un objectif et limiter les reports', () => {
  beforeAll(async () => {
    ;({ as, admin, xpOf, today } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Seul')`)
  })

  describe('reports', () => {
    it('un sous-objectif se reporte 2 fois, puis il est bloqué : plus de report, plus de retrait', async () => {
      const g = await goal(VAL, 'Sport', ALL)
      const t = await todayTask(g)
      const d = await today()
      await as(VAL, `select public.move_task($1, $2::date + 1)`, [t, d])
      await as(VAL, `select public.move_task($1, $2::date + 2)`, [t, d])
      expect((await tasksOf(g)).find((x) => x.id === t)?.postponed).toBe(2)
      await expect(as(VAL, `select public.move_task($1, $2::date + 3)`, [t, d])).rejects.toThrow(/Bloqué/)
      await expect(as(VAL, `select public.move_task($1, $2::date)`, [t, d])).rejects.toThrow(/Bloqué/)
      await expect(as(VAL, `select public.skip_task($1)`, [t])).rejects.toThrow(/Bloqué/)
    })

    it('avancer un sous-objectif futur ou le laisser au même jour ne compte pas comme un report', async () => {
      const d = await today()
      const g = await goal(VAL, 'Lecture', ALL)
      const t = await todayTask(g)
      await as(VAL, `select public.move_task($1, $2::date + 5)`, [t, d])
      expect((await tasksOf(g)).find((x) => x.id === t)?.postponed).toBe(1)
      await as(VAL, `select public.move_task($1, $2::date + 2)`, [t, d])
      expect((await tasksOf(g)).find((x) => x.id === t)?.postponed).toBe(1)
      await as(VAL, `select public.move_task($1, $2::date + 2)`, [t, d])
      expect((await tasksOf(g)).find((x) => x.id === t)?.postponed).toBe(1)
    })

    it('un sous-objectif bloqué se coche encore le jour venu', async () => {
      const g = await goal(VAL, 'Cuisine', ALL)
      const t = await todayTask(g)
      await admin(`update public.tasks set postponed = 2 where id = $1`, [t])
      await expect(as(VAL, `select public.toggle_task($1)`, [t])).resolves.toBeTruthy()
      expect((await tasksOf(g)).find((x) => x.id === t)?.done_at).toBeTruthy()
    })
  })

  describe('modifier les jours', () => {
    it('retirer des jours supprime les sous-objectifs pas faits à partir d’aujourd’hui, en ajouter les recrée', async () => {
      const n = await dow()
      const g = await goal(VAL, 'Yoga', ALL)
      expect((await tasksOf(g)).length).toBe(8 - n)
      await as(VAL, `select public.update_goal($1, array[${n}], true)`, [g])
      expect((await tasksOf(g)).map((x) => x.planned_date)).toEqual([await today()])
      await as(VAL, `select public.update_goal($1, ${ALL}, true)`, [g])
      expect((await tasksOf(g)).length).toBe(8 - n)
    })

    it('un sous-objectif déjà fait reste, même si son jour est retiré', async () => {
      const n = await dow()
      const g = await goal(VAL, 'Marche', ALL)
      await as(VAL, `select public.toggle_task($1)`, [await todayTask(g)])
      const other = n === 7 ? 1 : n + 1
      await as(VAL, `select public.update_goal($1, array[${other}], true)`, [g])
      const d = await today()
      const rows = await tasksOf(g)
      expect(rows.find((x) => x.planned_date === d)?.done_at).toBeTruthy()
    })

    it('un sous-objectif bloqué reste aussi, même si son jour est retiré', async () => {
      const n = await dow()
      const g = await goal(VAL, 'Rangement', ALL)
      const t = await todayTask(g)
      await admin(`update public.tasks set postponed = 2 where id = $1`, [t])
      const other = n === 7 ? 1 : n + 1
      await as(VAL, `select public.update_goal($1, array[${other}], true)`, [g])
      expect((await tasksOf(g)).some((x) => x.id === t)).toBe(true)
    })

    it('un sous-objectif reporté dont le jour d’origine est retiré disparaît (s’il n’est pas bloqué)', async () => {
      const n = await dow()
      const g = await goal(VAL, 'Piano', ALL)
      const t = await todayTask(g)
      const d = await today()
      await as(VAL, `select public.move_task($1, $2::date + 1)`, [t, d])
      const other = n === 7 ? 1 : n + 1
      await as(VAL, `select public.update_goal($1, array[${other}], true)`, [g])
      expect((await tasksOf(g)).some((x) => x.id === t)).toBe(false)
    })

    it('les jours passés de la semaine ne sont pas recréés quand on ajoute un jour', async () => {
      const n = await dow()
      if (n === 1) return // lundi : aucun jour passé dans la semaine
      const d = await today()
      const g = await goal(VAL, 'Dessin', `array[${n}]`)
      await as(VAL, `select public.update_goal($1, ${ALL}, true)`, [g])
      const dates = (await tasksOf(g)).map((x) => x.planned_date)
      expect(dates.length).toBe(8 - n)
      expect(dates.every((x) => x >= d)).toBe(true)
    })

    it('au moins un jour, des jours valides', async () => {
      const g = await goal(VAL, 'Vide', ALL)
      await expect(as(VAL, `select public.update_goal($1, array[]::int[], true)`, [g])).rejects.toThrow(/au moins un jour/)
      await expect(as(VAL, `select public.update_goal($1, array[8], true)`, [g])).rejects.toThrow(/au moins un jour/)
    })
  })

  describe('modifier la répétition', () => {
    it('arrêter la répétition garde la semaine en cours et efface les semaines suivantes', async () => {
      const n = await dow()
      const d = await today()
      const g = await goal(VAL, 'Méditation', ALL)
      await as(VAL, `select public.ensure_week($1::date + 7)`, [d])
      await as(VAL, `select public.ensure_week($1::date + 14)`, [d])
      expect((await tasksOf(g)).length).toBe(8 - n + 14)
      await as(VAL, `select public.update_goal($1, ${ALL}, false)`, [g])
      expect((await tasksOf(g)).length).toBe(8 - n)
      expect((await admin<{ recurring: boolean }>(`select recurring from public.goals where id = $1`, [g]))[0].recurring).toBe(false)
      // Plus rien ne se crée ensuite
      await as(VAL, `select public.ensure_week($1::date + 7)`, [d])
      expect((await tasksOf(g)).length).toBe(8 - n)
    })

    it('activer la répétition sur un objectif de la semaine l’étend aux semaines suivantes, avec les mêmes jours', async () => {
      const d = await today()
      const g = await goal(VAL, 'Courses', 'array[1,3,5]', false)
      const before = (await tasksOf(g)).length
      await as(VAL, `select public.update_goal($1, array[1,3,5], true)`, [g])
      expect((await tasksOf(g)).length).toBe(before)
      await as(VAL, `select public.ensure_week($1::date + 7)`, [d])
      const next = (await tasksOf(g)).filter((x) => x.planned_date > d)
      expect(next.length).toBeGreaterThanOrEqual(3)
    })

    it('activer la répétition sur un objectif d’une semaine passée la fait repartir la semaine suivante', async () => {
      const d = await today()
      const g = await goal(VAL, 'Jardin', ALL, false)
      await admin(`update public.goals set week_start = public.week_start(public.today_paris()) - 7 where id = $1`, [g])
      await as(VAL, `select public.update_goal($1, array[2,4], true)`, [g])
      const row = (await admin<{ ws: string; recurring: boolean; days: number[] }>(`select week_start::text as ws, recurring, days from public.goals where id = $1`, [g]))[0]
      expect(row.recurring).toBe(true)
      expect(row.days).toEqual([2, 4])
      const n = await dow()
      await as(VAL, `select public.ensure_week($1::date)`, [d])
      await as(VAL, `select public.ensure_week($1::date + 7)`, [d])
      const rows = await tasksOf(g)
      // La semaine en cours garde ses anciens sous-objectifs, la suivante suit les nouveaux jours
      expect(rows.filter((x) => x.planned_date < row.ws).length).toBe(8 - n)
      const fresh = await admin<{ dow: number }>(
        `select extract(isodow from planned_date)::int as dow from public.tasks where goal_id = $1 and planned_date >= $2::date order by planned_date`, [g, row.ws])
      expect(fresh.map((x) => x.dow)).toEqual([2, 4])
    })

    it('un objectif ponctuel d’une semaine passée ne peut pas être modifié sans répétition', async () => {
      const g = await goal(VAL, 'Vieux', ALL, false)
      await admin(`update public.goals set week_start = public.week_start(public.today_paris()) - 7 where id = $1`, [g])
      await expect(as(VAL, `select public.update_goal($1, array[1], false)`, [g])).rejects.toThrow(/semaine passée/)
    })
  })

  describe('droits et durée', () => {
    it('on ne modifie pas l’objectif perso de l’autre, mais un objectif commun oui', async () => {
      const mine = await goal(VAL, 'Perso de Val', ALL)
      await expect(as(JULIE, `select public.update_goal($1, array[1], true)`, [mine])).rejects.toThrow(/propriétaire/)
      const common = await goal(VAL, 'Commun', ALL, true, true)
      await as(JULIE, `select public.update_goal($1, ${ALL}, true)`, [common])
      await expect(as(OTHER, `select public.update_goal($1, ${ALL}, true)`, [common])).rejects.toThrow(/introuvable/)
    })

    it('un objectif arrêté ne se modifie plus', async () => {
      const g = await goal(VAL, 'Stoppé', ALL)
      await as(VAL, `select public.archive_goal($1)`, [g])
      await expect(as(VAL, `select public.update_goal($1, ${ALL}, true)`, [g])).rejects.toThrow(/arrêté/)
    })

    it('changer la durée ne change que les prochains gains : l’XP déjà gagnée reste', async () => {
      const g = await goal(VAL, 'Étirements', ALL)
      const t = await todayTask(g)
      const before = await xpOf(VAL)
      await as(VAL, `select public.toggle_task($1)`, [t])
      const gained = (await xpOf(VAL)) - before
      expect(gained).toBeGreaterThan(0)
      await as(VAL, `update public.goals set minutes = 90 where id = $1`, [g])
      expect((await xpOf(VAL)) - before).toBe(gained)
    })
  })
})
