import { ROOT_FREQUENCIES, defaultBeatHz, getFrequency } from './catalog'
import type { Journey, JourneyDay, JourneyPurpose } from './types'

/**
 * Composes a journey from a handful of answers.
 *
 * Everything in the catalogue was written by hand, one day at a time, which is
 * why there are forty-four of them and not four hundred: a journey is a set of
 * decisions about pitch, rate, tempo, density and depth across a week, and most
 * of those decisions follow from a few facts about what the week is *for*. This
 * takes those few facts and derives the rest.
 *
 * It is deliberately a generator and not a form. Nothing here asks for a
 * frequency or a brainwave band — those are the answers, not the questions.
 * What it asks is what the sessions are for, how many, how long, how they
 * should sound and which way they should travel; the ladder, the band, the rate
 * ramp and the per-day shaping all come out of that.
 *
 * The invariants the hand-written catalogue is tested against apply here too,
 * and are tested separately in `journeyBuilder.test.ts` — a generated journey
 * that broke the club-engine rule or declared an arc it does not walk would be
 * a bug that no amount of care in the JSON could catch.
 */

export type BuilderGoal =
  | 'sleep'
  | 'calm'
  | 'focus'
  | 'energy'
  | 'spiritual'
  | 'body'
  | 'club'

export type BuilderSound = 'still' | 'flowing' | 'beat'
export type BuilderShape = 'ascending' | 'descending' | 'steady'

export type BuilderAnswers = {
  goal: BuilderGoal
  days: number
  minutes: number
  sound: BuilderSound
  shape: BuilderShape
}

export const BUILDER_DEFAULTS: BuilderAnswers = {
  goal: 'calm',
  days: 7,
  minutes: 20,
  sound: 'still',
  shape: 'ascending',
}

export const DAY_CHOICES = [3, 5, 7, 10, 14]
export const MINUTE_CHOICES = [15, 20, 30, 45, 60]

/** The catalogue purpose a goal files under. */
const GOAL_PURPOSE: Record<BuilderGoal, JourneyPurpose> = {
  sleep: 'sleep',
  calm: 'anxiety',
  focus: 'focus',
  energy: 'energy',
  spiritual: 'spiritual',
  body: 'body',
  club: 'club',
}

/**
 * The band each goal runs underneath, and the rate window inside it.
 *
 * The window matters more than the band: a sleep week that sits at delta's
 * midpoint every night is seven identical nights, and the whole treatment is
 * the descent through it. `[from, to]` is walked across the days.
 */
const GOAL_BEAT: Record<BuilderGoal, { id: string; from: number; to: number }> = {
  sleep: { id: 'bb-delta', from: 3.6, to: 1.0 },
  calm: { id: 'bb-alpha', from: 10.5, to: 8.5 },
  focus: { id: 'bb-beta', from: 15, to: 19 },
  energy: { id: 'bb-beta', from: 16, to: 22 },
  spiritual: { id: 'bb-theta', from: 7.0, to: 4.6 },
  body: { id: 'bb-alpha', from: 9.0, to: 11.0 },
  club: { id: 'bb-beta', from: 16, to: 24 },
}

/** A club goal has to pick an engine; the rest stay on the ambient one. */
const CLUB_STYLE_BY_SHAPE = {
  ascending: 'psytrance',
  descending: 'deephouse',
  steady: 'techno',
} as const

/**
 * pace, density and depth at the two ends of the week.
 *
 * `still` is the long-form end — a tone that holds until it nearly goes.
 * `beat` has to clear the tempo floor the club tests enforce, so its pace never
 * starts below 0.45.
 */
const SOUND_SHAPE: Record<
  BuilderSound,
  { pace: [number, number]; density: [number, number]; depth: [number, number] }
> = {
  still: { pace: [0.08, 0.16], density: [0.16, 0.3], depth: [0.2, 0.5] },
  flowing: { pace: [0.32, 0.5], density: [0.4, 0.58], depth: [0.2, 0.45] },
  beat: { pace: [0.5, 0.82], density: [0.5, 0.78], depth: [0.3, 0.7] },
}

/** Depth 0.5 is where the melody leaves familiar intervals; some goals must not. */
const SHALLOW_GOALS: BuilderGoal[] = ['sleep', 'calm', 'focus', 'body']

/**
 * What that day is, in a few words.
 *
 * The first version numbered them — "day 3" — next to a column that already
 * says 3, which is the definition of filler. A day is worth a line only if the
 * line says what moved, so these name the step the schedule actually takes.
 */
function noteFor(i: number, days: number, shape: BuilderShape): { note: string; noteEn: string } {
  if (i === 0) return { note: 'הצעד הראשון', noteEn: 'The first step' }
  if (i === days - 1) {
    // A descending week ends at its lowest, not its highest — the last line has
    // to know which way the week went.
    if (shape === 'ascending') return { note: 'הגבוה שבהם', noteEn: 'The highest of them' }
    if (shape === 'descending') return { note: 'הנמוך שבהם', noteEn: 'The lowest of them' }
    return { note: 'המלא שבהם', noteEn: 'The fullest of them' }
  }
  if (shape === 'ascending') return { note: 'עולה מדרגה', noteEn: 'One rung up' }
  if (shape === 'descending') return { note: 'יורד מדרגה', noteEn: 'One rung down' }
  return { note: 'אותו שורש, שכבה נוספת', noteEn: 'The same root, one more layer' }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The pitches a week walks, in the order it walks them.
 *
 * Solfeggio only: the tuning references and the cosmic tones are single points
 * people come to on purpose rather than rungs on a ladder, and mixing 432 into
 * a climb from 396 to 963 makes the arc read as a mistake.
 */
function ladder(days: number, shape: BuilderShape, goal: BuilderGoal): string[] {
  const scale = ROOT_FREQUENCIES.filter((f) => f.id.startsWith('sol-')).sort(
    (a, b) => (a.hz ?? 0) - (b.hz ?? 0),
  )

  if (shape === 'steady') {
    // One root, held. Which one is the only real choice a steady week makes,
    // so it comes from the goal rather than from the middle of the list.
    const held =
      goal === 'sleep' ? 'sol-174'
      : goal === 'calm' ? 'sol-396'
      : goal === 'focus' ? 'sol-741'
      : goal === 'energy' ? 'sol-528'
      : goal === 'spiritual' ? 'sol-963'
      : goal === 'body' ? 'sol-285'
      : 'sol-528'
    return Array.from({ length: days }, () => held)
  }

  // Sample the scale evenly so a fourteen-night week repeats rungs rather than
  // running out of them, and a three-night week still spans the whole range.
  const ordered = shape === 'descending' ? [...scale].reverse() : scale
  return Array.from({ length: days }, (_, i) => {
    const t = days === 1 ? 0 : i / (days - 1)
    return ordered[Math.round(t * (ordered.length - 1))].id
  })
}

/** Human-readable name for the week, in both languages. */
function names(a: BuilderAnswers): { title: string; titleEn: string } {
  const he: Record<BuilderGoal, string> = {
    sleep: 'להירדם',
    calm: 'להירגע',
    focus: 'להתרכז',
    energy: 'אנרגיה',
    spiritual: 'פנימה',
    body: 'הגוף',
    club: 'רחבה',
  }
  const en: Record<BuilderGoal, string> = {
    sleep: 'Falling asleep',
    calm: 'Settling',
    focus: 'Focus',
    energy: 'Energy',
    spiritual: 'Inward',
    body: 'The body',
    club: 'The floor',
  }
  return {
    title: `${he[a.goal]} — ${a.days} ימים`,
    titleEn: `${en[a.goal]} — ${a.days} days`,
  }
}

function describe(a: BuilderAnswers, sched: JourneyDay[]): { he: string; en: string } {
  const first = getFrequency(sched[0].frequencyId)
  const last = getFrequency(sched[sched.length - 1].frequencyId)
  const band = getFrequency(GOAL_BEAT[a.goal].id)
  const from = sched[0].beatHz
  const to = sched[sched.length - 1].beatHz
  const bandHe = band?.label.split('—')[0].trim() ?? ''
  const bandEn = band?.labelEn.split('—')[0].trim() ?? ''

  const moveHe =
    a.shape === 'steady'
      ? `הסולם לא זז: כל ${a.days} הימים על ${first?.hz}Hz, כך שמה שמשתנה הוא רק איך הוא מנוגן`
      : `הסולם ${a.shape === 'ascending' ? 'עולה' : 'יורד'} מ-${first?.hz}Hz ל-${last?.hz}Hz`
  const moveEn =
    a.shape === 'steady'
      ? `The scale does not move: all ${a.days} days sit on ${first?.hz}Hz, so the only thing that changes is how it is played`
      : `The scale ${a.shape === 'ascending' ? 'climbs' : 'falls'} from ${first?.hz}Hz to ${last?.hz}Hz`

  const soundHe =
    a.sound === 'still'
      ? 'תו אחד מחזיק ונפתח, והבא נכנס רק אחרי שהראשון כמעט נגמר'
      : a.sound === 'flowing'
        ? 'זרימה קבועה של תווים — נוכח מספיק להישען עליו, דליל מספיק לא לדרוש קשב'
        : 'על גריד, עם קיק ובס — זה נבנה כדי לזוז אליו'
  const soundEn =
    a.sound === 'still'
      ? 'A tone holds and opens, and the next arrives only once the first has nearly gone'
      : a.sound === 'flowing'
        ? 'A steady flow of notes — present enough to lean on, sparse enough not to ask for attention'
        : 'On a grid, with a kick and a bass — this is built to move to'

  return {
    he: `${a.days} ימים, ${a.minutes} דקות בכל פעם. ${moveHe}. ${soundHe}. מתחת רץ ${bandHe} מ-${from}Hz ל-${to}Hz.`,
    en: `${a.days} days, ${a.minutes} minutes each. ${moveEn}. ${soundEn}. ${bandEn} runs underneath, from ${from}Hz to ${to}Hz.`,
  }
}

/**
 * Builds the journey. Pure: the same answers always give the same week, which
 * is what lets the preview screen show exactly what will be saved.
 */
export function buildJourney(answers: BuilderAnswers, id: string): Journey {
  const a = { ...answers, days: Math.max(1, Math.round(answers.days)) }
  const purpose = GOAL_PURPOSE[a.goal]
  // A club week must run a club engine on every day and nothing else may run
  // one — the catalogue is tested on exactly that, and a generated journey has
  // no reason to be the exception.
  const isClub = a.goal === 'club'
  const sound: BuilderSound = isClub ? 'beat' : a.sound === 'beat' ? 'flowing' : a.sound
  const shapeOf = SOUND_SHAPE[sound]
  const beat = GOAL_BEAT[a.goal]
  const band = getFrequency(beat.id)
  const [lo, hi] = band?.range ?? [0.5, 50]
  const rungs = ladder(a.days, a.shape, a.goal)
  const capDepth = SHALLOW_GOALS.includes(a.goal) ? 0.45 : 1

  const schedule: JourneyDay[] = rungs.map((frequencyId, i) => {
    const t = a.days === 1 ? 0 : i / (a.days - 1)
    const beatHz = round2(Math.min(hi, Math.max(lo, lerp(beat.from, beat.to, t))))
    const day: JourneyDay = {
      day: i + 1,
      frequencyId,
      durationMin: a.minutes,
      ...noteFor(i, a.days, a.shape),
      pace: round2(lerp(shapeOf.pace[0], shapeOf.pace[1], t)),
      depth: round2(Math.min(capDepth, lerp(shapeOf.depth[0], shapeOf.depth[1], t))),
      density: round2(lerp(shapeOf.density[0], shapeOf.density[1], t)),
      beatId: beat.id,
      beatHz,
    }
    if (isClub) day.style = CLUB_STYLE_BY_SHAPE[a.shape]
    return day
  })

  const text = describe(a, schedule)
  const { title, titleEn } = names(a)

  return {
    id,
    title,
    titleEn,
    days: a.days,
    purpose,
    description: text.he,
    descriptionEn: text.en,
    // Only declared when it is walked. A steady week has no arc, and claiming
    // one it does not walk is the failure the catalogue test exists to catch.
    ...(a.shape === 'steady' ? {} : { arc: a.shape }),
    schedule,
  }
}

/** The rate a band starts at, for the preview line. */
export const bandStartHz = (id: string) => {
  const f = getFrequency(id)
  return f ? defaultBeatHz(f) : 0
}
