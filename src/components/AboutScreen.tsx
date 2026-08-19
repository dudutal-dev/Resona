import { BEAT_FREQUENCIES, JOURNEYS, ROOT_FREQUENCIES } from '../lib/catalog'
import { ABOUT } from '../lib/aboutContent'
import { renderRich, useT } from '../lib/i18n'
import { Card, Screen } from './ui'

/**
 * Version, commit and date of the build that is actually running — see
 * `buildStamp` in the Vite config. Printed rather than kept in a comment so a
 * screenshot is enough to tell whether the phone is on the current commit.
 */
const BUILD = __BUILD__
/** Just the semver, for the places that name the app rather than identify it. */
const APP_VERSION = BUILD.split(' · ')[0]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <div className="txt-2 space-y-2 text-[12px] leading-relaxed">{children}</div>
    </Card>
  )
}

export function AboutScreen() {
  const { t, lang } = useT()
  // The counts are the only numbers in the prose that must not be written by
  // hand, because they change whenever the catalogue does.
  const counts = {
    roots: ROOT_FREQUENCIES.length,
    bands: BEAT_FREQUENCIES.length,
    journeys: JOURNEYS.length,
  }
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in counts ? String(counts[name as keyof typeof counts]) : whole,
    )

  return (
    <Screen title={t('about.title')} subtitle={t('about.version', { v: APP_VERSION })} onBack>
      {/* Credit */}
      <Card glow className="mb-5 text-center">
        <div
          className="mx-auto grid h-[74px] w-[74px] place-items-center rounded-full"
          style={{
            background: 'var(--gold-soft)',
            border: '1px solid var(--gold)',
            boxShadow: '0 0 44px -10px var(--gold)',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--gold)' }} aria-hidden>
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.4" opacity="0.65" />
            <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          </svg>
        </div>
        <h2 className="mt-4 text-[26px] font-extrabold tracking-tight">Resona</h2>
        <p className="txt-3 mt-1 text-[11px]">{t('about.byline')}</p>
        <p className="mt-0.5 text-lg font-extrabold" style={{ color: 'var(--gold)' }}>
          {t('about.author')}
        </p>
      </Card>

      {ABOUT[lang].map((section) => (
        <Section key={section.title} title={section.title}>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>{renderRich(fill(paragraph))}</p>
          ))}
        </Section>
      ))}

      <p className="txt-3 mt-5 px-1 text-center text-[11px]">
        {t('about.footer', { year: new Date().getFullYear(), v: APP_VERSION })}
      </p>
      {/* The line that answers "are we looking at the same thing?" — compare it
          against `git log --oneline -1`. */}
      <p className="txt-3 mt-1 px-1 text-center text-[10px] opacity-70">
        {/* Only the stamp is LTR. Putting the Hebrew label inside the isolated
            run reorders it into the middle of the commit. */}
        {t('about.build')} <span className="readout">{BUILD}</span>
      </p>
    </Screen>
  )
}
