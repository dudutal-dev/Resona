import { useT } from '../lib/i18n'
import { useSettings } from '../store/settingsStore'
import { useSession } from '../store/sessionStore'
import { Sheet } from './ui'

/**
 * Shown once, before the first session.
 *
 * Browsers cannot detect whether headphones are connected — there is no such
 * web API — so the app does the honest thing instead of guessing: it defaults
 * to the speaker-safe isochronic mode and explains when headphones actually
 * matter, letting the listener make the call.
 */
export function HeadphoneNotice() {
  const { t } = useT()
  const { headphoneNoticeSeen, dismissHeadphoneNotice } = useSettings()
  const setBeatMode = useSession((s) => s.setBeatMode)

  return (
    <Sheet
      open={!headphoneNoticeSeen}
      onClose={dismissHeadphoneNotice}
      title={t('notice.title')}
    >
      <div className="space-y-4">
        <p className="txt-2 text-sm leading-relaxed">
          {t('notice.intro')}
        </p>

        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-bold">{t('notice.isoTitle')}</p>
          <p className="txt-2 mt-1 text-[12px] leading-relaxed">
            {t('notice.isoBody')}
          </p>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-bold">{t('notice.binTitle')}</p>
          <p className="txt-2 mt-1 text-[12px] leading-relaxed">
            {t('notice.binBody')}
          </p>
        </div>

        <p className="txt-3 text-[11px] leading-relaxed">
          {t('notice.footer')}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setBeatMode('binaural')
              dismissHeadphoneNotice()
            }}
            className="obj flex-1 rounded-full px-4 py-3.5 text-[13px] font-extrabold"
          >
            {t('notice.chooseBinaural')}
          </button>
          <button
            onClick={() => {
              setBeatMode('isochronic')
              dismissHeadphoneNotice()
            }}
            className="cta flex-1 px-4 py-3.5 text-[13px]"
          >
            {t('notice.chooseIso')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
