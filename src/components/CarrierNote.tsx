import { carrierFor } from '../audio/scale'
import { getFrequency } from '../lib/catalog'
import { useT } from '../lib/i18n'
import type { StringKey } from '../lib/i18n'
import { useSession } from '../store/sessionStore'

/**
 * One line saying what the two layers are doing to each other.
 *
 * The whole idea of this app is that nothing is arbitrary: the brainwave layer
 * is not a separate tone laid beside the frequency, it is carried on a pitch
 * folded down from the root itself, so the two layers are consonant by
 * construction rather than by luck. That was true from the first version and
 * completely invisible — the screen showed 528Hz and 6Hz side by side, two
 * numbers with no stated relationship, which is exactly what a listener would
 * assume they were.
 *
 * So the relationship is stated. It reads from the same `carrierFor` the audio
 * uses, not from a duplicate of the rule, which means it cannot drift out of
 * agreement with what is actually sounding.
 */
export function CarrierNote() {
  const { t, rich } = useT()
  const { config } = useSession()

  const root = getFrequency(config.rootId)
  if (!root?.hz || !config.beatId) return null

  const carrier = Math.round(carrierFor(root.hz))
  const octaves = Math.round(Math.log2(root.hz / carrier))

  const relation: Record<number, StringKey> = {
    1: 'relation.octaveDown',
    2: 'relation.twoOctavesDown',
    3: 'relation.threeOctavesDown',
  }
  const key = relation[octaves]

  return (
    <p className="txt-3 mt-3 text-center text-[11px] leading-relaxed">
      {key
        ? rich('player.carrier', { carrier, relation: t(key) })
        : t('player.carrierSame')}
    </p>
  )
}
