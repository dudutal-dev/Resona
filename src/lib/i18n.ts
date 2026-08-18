import { createElement, Fragment, type ReactNode } from 'react'
import { useSettings } from '../store/settingsStore'

/**
 * Interface language.
 *
 * Hebrew is the original and stays the default; English is a full second
 * interface rather than a partial one, which is why the catalogue data carries
 * English fields too (see `catalog.ts`). Anything user-visible that exists in
 * one language must exist in the other, and the types below enforce that: the
 * English table is declared as a total record over the Hebrew table's keys, so
 * a missing translation is a compile error rather than a Hebrew word appearing
 * in an English screen.
 */
export type Lang = 'he' | 'en'

export const LANGS: readonly Lang[] = ['he', 'en']
export const LANG_LABEL: Record<Lang, string> = { he: 'עברית', en: 'English' }
export const DIR: Record<Lang, 'rtl' | 'ltr'> = { he: 'rtl', en: 'ltr' }

const HE = {
  // ------------------------------------------------------------------ shared
  'app.tagline': 'תדרים ומסעות',
  'common.back': 'חזרה',
  'common.close': 'סגירה',
  'common.play': 'נגינה',
  'common.stop': 'עצירה',
  'common.save': 'שמור',
  'common.min': 'דק׳',
  'common.minutes': 'דקות',
  'common.done': 'הושלם ✓',
  'common.dayN': 'יום {n}',
  'common.daysN': '{n} ימים',
  'common.dayOf': 'יום {n} מתוך {total}',

  'nav.aria': 'ניווט ראשי',
  'nav.home': 'בית',
  'nav.journeys': 'מסעות',
  'nav.frequencies': 'תדרים',
  'nav.presets': 'פריסטים',
  'nav.settings': 'הגדרות',

  // ------------------------------------------------------------------ splash
  'splash.aria': 'מסך פתיחה',
  'splash.tagline': 'כל טבעת היא מרווח הרמוני של אותו תדר יסוד — וכך גם כל תו שתשמע.',
  'splash.start': 'התחל',
  'splash.tapAnywhere': 'אפשר להקיש בכל מקום',

  // -------------------------------------------------------------------- home
  'home.greet.night': 'לילה טוב',
  'home.greet.morning': 'בוקר טוב',
  'home.greet.afternoon': 'צהריים טובים',
  'home.greet.evening': 'ערב טוב',
  'home.tagline': 'מוזיקה שמולחנת <accent>סביב</accent> תדר היעד — לא טון שמונח לידה. כל תו נגזר מתמטית מהתדר שבחרת.',
  'home.nowPlaying': 'מתנגן כעת',
  'home.continue': 'המשך האזנה',
  'home.activeJourney': 'מסע פעיל',
  'home.myJourneys': 'המסעות שלי',
  'home.journeyCount': '{n} מסעות מודרכים',
  'home.myPresets': 'הפריסטים שלי',
  'home.presetCount': '{n} שמורים',
  'home.noPresets': 'עוד אין שמורים',
  'home.browse': 'עיין בתדרים',
  'home.browseSub': '<ltr>{roots}</ltr> תדרי יסוד ו-<ltr>{bands}</ltr> טווחי גלי מוח — עם רמת הביסוס של כל אחד',
  'home.disclaimer': 'Resona הוא כלי להרפיה והאזנה בלבד. אינו מכשיר רפואי ואינו תחליף לייעוץ מקצועי. כל הנתונים נשמרים במכשיר שלך בלבד.',

  // ------------------------------------------------------------------ player
  'player.title': 'נגן',
  'player.subtitle': 'התדר, המלודיה והשכבות',
  'player.infoAria': 'מידע על התדר',
  'player.change': 'החלף תדר',
  'player.finishDay': 'סיים יום',
  'player.saved': 'נשמר ✓',
  'player.savePreset': 'שמור פריסט',
  'player.pickerTitle': 'בחירת תדר',
  'player.saveTitle': 'שמירת פריסט',
  'player.presetName': 'שם הפריסט',
  'player.presetPlaceholder': '{root} להירדם',
  'player.saveNote': 'נשמרים: תדר היסוד, הגל המוחי וקצב הפעימה, אופן ההשמעה, סאונד הסביבה, עוצמת כל שכבה, צפיפות הנגינה והטיימר.',
  'player.finishTitle': 'איך מרגיש עכשיו?',
  'player.finishNote': 'סימון היום כהושלם. הדירוג נשמר מקומית ומופיע בסיכום המסע.',
  'player.defaultPresetName': 'פריסט',

  'mini.remaining': ' · נותרו {clock}',

  'tv.enter': 'מצב טלוויזיה',
  'tv.enterHint': 'מסך מלא עם ההדמיה בלבד — ומשם שיקוף מסך מעביר אותה לטלוויזיה.',
  'tv.exit': 'יציאה',
  'player.mix': 'מיקס',
  'player.mixTitle': 'מיקס והגדרות סשן',
  'player.carrier': 'הפעימה רוכבת על <ltr>{carrier} Hz</ltr> — {relation} לשורש',
  'player.carrierSame': 'הפעימה רוכבת על השורש עצמו',
  'relation.octaveDown': 'אוקטבה מתחת',
  'relation.twoOctavesDown': 'שתי אוקטבות מתחת',
  'relation.threeOctavesDown': 'שלוש אוקטבות מתחת',
  'figure.pick': 'דמויות',
  'figure.pickTitle': 'בחר דמות',
  'history.title': 'האזנות אחרונות',
  'history.empty': 'עוד לא האזנת. מה שתנגן יופיע כאן.',
  'history.clear': 'נקה היסטוריה',
  'history.minutes': '<ltr>{n}</ltr> דק׳',
  'history.today': 'היום',
  'history.yesterday': 'אתמול',
  'history.daysAgo': 'לפני <ltr>{n}</ltr> ימים',
  'figure.chakras': 'צ׳אקרות',
  'figure.spectrum': 'ספקטרום',
  'figure.violet': 'סגול',
  'figure.starlight': 'אור כוכבים',
  'figure.temple': 'מקדש',
  'figure.cosmos': 'קוסמוס',
  'figure.crimson': 'ארגמן',
  'figure.forest': 'יער',
  'figure.jupiter': 'צדק',
  'figure.emerald': 'ברקת',
  'figure.amber': 'ענבר',
  'figure.scene': 'תלת־ממד',
  'tv.mirror': 'לטלוויזיה: מרכז הבקרה ← שיקוף מסך ← בחר את הטלוויזיה. גם התמונה וגם הקול עוברים יחד, ולכן כדאי שהפלט כאן יישאר על הטלפון ולא על AirPlay.',
  'tv.rotate': 'סובב את הטלפון לרוחב — השיקוף מעביר את המסך כמו שהוא, ולרוחב הוא ימלא את הטלוויזיה.',
  'tv.hint': 'הקש כדי להציג את הפקדים · יציאה עם Esc',

  // ------------------------------------------------------------------- timer
  'timer.label': 'טיימר',
  'timer.fading': 'הדעיכה החלה — העוצמה יורדת בהדרגה עד לשקט.',
  'timer.fadeNote': 'בסיום הזמן העוצמה דועכת לאורך {seconds} שניות במקום להיפסק בבת אחת.',
  'timer.15': '15 דקות',
  'timer.30': '30 דקות',
  'timer.60': 'שעה',
  'timer.120': 'שעתיים',
  'timer.untilMorning': 'עד הבוקר',
  'timer.unlimited': 'ללא הגבלה',
  'timer.custom': 'מותאם',

  // --------------------------------------------------------- listening mode
  'listen.headphones': 'אוזניות',
  'listen.headphonesHint': 'ביינאורל — כל אוזן מקבלת תדר מעט שונה',
  'listen.speakers': 'רמקולים',
  'listen.speakersHint': 'איזוכרוני — צליל אחד שנפעם, עובד בכל השמעה',
  'listen.question': 'איך אתה מאזין?',
  'listen.savedForLater': 'נשמר להמשך',
  'listen.groupAria': 'אופן ההאזנה',
  'listen.binauralWarning': 'ביינאורל נוצר מההפרש בין האוזניים. ברמקולים שני הצלילים מתערבבים באוויר והאפקט לא נוצר — חבר אוזניות, או בחר רמקולים.',
  'listen.noBeatNote': 'בהאזנה הזו אין שכבת גלים מוחיים, ולכן הבחירה לא משנה את מה שתשמע כרגע — המלודיה זהה באוזניות וברמקולים. הבחירה נשמרת ותחול על כל האזנה שכן כוללת גל מוחי.',

  'notice.title': 'לפני שמתחילים',
  'notice.intro': 'שכבת הגלים המוחיים יכולה לפעול בשני אופנים:',
  'notice.isoTitle': 'איזוכרוני — ברירת המחדל',
  'notice.isoBody': 'צליל בודד שנפעם בקצב הנבחר. עובד ברמקולים, באוזניות, בכל דבר.',
  'notice.binTitle': 'ביינאורל — מחייב אוזניות',
  'notice.binBody': 'כל אוזן מקבלת תדר מעט שונה, והמוח משלים את ההפרש. ברמקולים שני הצלילים מתערבבים באוויר והאפקט פשוט לא נוצר — לכן זו אינה ברירת המחדל.',
  'notice.footer': 'הדפדפן אינו יכול לזהות אם חיברת אוזניות, ולכן הבחירה נשארת אצלך. אפשר להחליף בכל רגע במיקסר. אם יש לך אפילפסיה או רגישות לגירוי קצבי — היוועץ ברופא לפני שימוש בשכבה הזו.',
  'notice.chooseBinaural': 'יש לי אוזניות — ביינאורל',
  'notice.chooseIso': 'המשך באיזוכרוני',

  'mood.1': 'קשה',
  'mood.2': 'לא משהו',
  'mood.3': 'בסדר',
  'mood.4': 'טוב',
  'mood.5': 'מצוין',

  // ---------------------------------------------------------------- journeys
  'journeys.title': 'מסעות',
  'journeys.subtitle': '{n} תוכניות, מקובצות לפי נושא',
  'journeys.all': 'הכול',
  'journeys.ascending': 'עולה בסולם',
  'journeys.descending': 'יורד בסולם',
  'journeys.startsWith': 'מתחיל ב־',
  'journeys.footer': 'המסעות הם מבנה האזנה מוצע, לא פרוטוקול טיפולי. אפשר לדלג בין ימים בכל שלב, ואפשר להוסיף מסעות משלך בקובץ <ltr>src/data/journeys.json</ltr>.',
  'journey.notFound': 'מסע לא נמצא',
  'journey.notFoundBody': 'המסע הזה כבר לא קיים בקטלוג.',
  'journey.ascendingMark': '↑ עולה בסולם',
  'journey.descendingMark': '↓ יורד בסולם',
  'journey.listenAgain': 'האזן שוב',
  'journey.continue': 'המשך — יום {n}',
  'journey.start': 'התחל מסע',
  'journey.resetConfirm': 'לאפס את ההתקדמות במסע הזה?',
  'journey.reset': 'איפוס התקדמות',
  'journey.today': 'היום שלך',

  'day.notFound': 'יום לא נמצא',
  'day.notFoundBody': 'אין יום כזה במסע הזה.',
  'day.supporting': 'מתחת לתדר רץ גל מוחי תומך — ',
  'day.supportingTail': ', בעוצמה נמוכה כדי שתדר היום יישאר במרכז.',
  'day.start': 'התחל את היום',
  'day.again': 'האזן שוב ליום זה',
  'day.whatIsClaimed': 'מה מיוחס לתדר הזה?',
  'day.howDidYouFeel': 'איך הרגשת אחרי ההאזנה?',
  'day.moodDone': 'אפשר לעדכן את הדירוג בכל שלב. הכול נשמר במכשיר בלבד.',
  'day.moodNew': 'דירוג מסמן את היום כהושלם ומעביר ליום הבא.',

  // ----------------------------------------------------------------- presets
  'presets.title': 'הפריסטים שלי',
  'presets.subtitle': 'שילובים שמורים, נטענים בדיוק כפי שנשמרו',
  'presets.emptyTitle': 'עדיין אין פריסטים',
  'presets.emptyBody': 'בנה שילוב במסך הנגן — תדר, שכבות, עוצמות וטיימר — ושמור אותו בשם.',
  'presets.toPlayer': 'למסך הנגן',
  'presets.playAria': 'נגן את {name}',
  'presets.editAria': 'עריכת {name}',
  'presets.deleteAria': 'מחיקת {name}',
  'presets.deleteConfirm': 'למחוק את "{name}"?',
  'presets.editTitle': 'עריכת פריסט',
  'presets.name': 'שם',
  'presets.saveName': 'שמור שם',
  'presets.updateToCurrent': 'עדכן להגדרות הנוכחיות במיקסר',
  'presets.unnamed': 'פריסט ללא שם',

  // ---------------------------------------------------------------- settings
  'settings.title': 'הגדרות',
  'settings.language': 'שפה',
  'settings.languageHint': 'משנה את כל הממשק, שמות התדרים ותוכן המסעות.',
  'settings.theme': 'ערכת נושא',
  'settings.themeHint': 'שחור הוא שחור אמיתי, בלי זיגוג ובצבעים חדים — ובמסך OLED הפיקסלים כבויים ממש.',
  'settings.theme.dark': 'כהה',
  'settings.theme.noir': 'שחור',
  'settings.theme.light': 'בהיר',
  'settings.reducedMotion': 'הפחתת תנועה',
  'settings.reducedMotionHint': 'מרגיע את הוויזואליזציה ואת רקע האורורה — עדיף לפני שינה או ברגישות לתנועה.',
  'settings.localData': 'נתונים מקומיים',
  'settings.localDataBody': 'לאפליקציה אין שרת, אין חשבון ואין סנכרון. הפריסטים, התקדמות המסעות וההגדרות שמורים ב-localStorage של הדפדפן הזה בלבד — ניקוי נתוני הדפדפן ימחק אותם.',
  'settings.resetAll': 'איפוס כל הנתונים המקומיים',
  'settings.resetConfirm': 'לאפס את כל הנתונים המקומיים? פריסטים והתקדמות במסעות יימחקו לצמיתות.',
  'settings.wiped': 'הנתונים נמחקו',
  'settings.about': 'אודות',
  'settings.aboutHint': 'איך האפליקציה עובדת, נגינה ברקע, פרטיות, שקיפות והקרדיטים',

  // ------------------------------------------------------------- frequencies
  'freq.title': 'תדרים',
  'freq.subtitle': 'בחר תדר יסוד וטווח גל מוחי — ולחץ על ⓘ כדי לראות על מה כל טענה נשענת',
  'freq.play': 'לנגן',
  'freq.rootTitle': 'תדר יסוד',
  'freq.rootHint': 'כל תו במלודיה נגזר ממנו',
  'freq.beatsTitle': 'גלי מוח',
  'freq.beatsHint': 'מהאיטי למהיר',
  'freq.noBeat': 'ללא שכבת גל מוחי',
  'freq.infoAria': 'מידע על {name}',
  'freq.group.solfeggio': 'סולם הסולפג׳יו',
  'freq.group.solfeggioNote': 'תשעה תדרים מהמסורת, מהנמוך לגבוה',
  'freq.group.tuning': 'כוונונים',
  'freq.group.tuningNote': 'תקנים מוזיקליים — כולל 440Hz עצמו, להשוואה',
  'freq.group.cosmic': 'האוקטבה הקוסמית',
  'freq.group.cosmicNote': 'מחזורים ותהודות מדודים, מוכפלים באוקטבות עד לשמיעה',

  'info.claimed': 'מה מיוחס לתדר',
  'info.howItSounds': 'איך התדר נשמע כאן',
  'info.howItSoundsBody': 'התדר אינו מונח ברקע כטון נפרד. הוא משמש כתדר היסוד של הסולם — כל תו במלודיה הוא מכפלה של <ltr>{hz} Hz</ltr> ביחס הרמוני טהור (כמו <ltr>3/2</ltr> או <ltr>5/4</ltr>), כך שהמוזיקה עצמה בנויה מהתדר ולא רק לצידו.',
  'info.disclaimer': 'Resona הוא כלי להרפיה והאזנה. אינו מכשיר רפואי, אינו מאבחן ואינו מטפל במצב בריאותי כלשהו, ואינו תחליף לייעוץ מקצועי. אם יש לך אפילפסיה, רגישות לגירוי קצבי, או מצב נוירולוגי — היוועץ ברופא לפני שימוש בשכבת הגלים המוחיים.',
  'type.solfeggio': 'סולם סולפג׳יו מסורתי',
  'type.tuning': 'כוונון מוזיקלי',
  'type.cosmic': 'מחזור מדוד, מוכפל באוקטבות',
  'type.binaural': 'טווח גלי מוח',

  'trust.traditional': 'מסורתי',
  'trust.research_backed_partial': 'ראיות חלקיות',
  'trust.reference': 'ייחוס',
  'trust.traditional.notice': 'מבוסס מסורת ואמונה תרבותית ואינו נתמך בראיות מדעיות קליניות.',
  'trust.research_backed_partial.notice': 'קיימות ראיות מחקריות חלקיות ולא עקביות.',
  'trust.reference.notice': 'כוונון ייחוס בשימוש כללי. אינו נושא טענת השפעה כלשהי.',

  // ------------------------------------------------------------------- mixer
  'mixer.melody': 'מלודיה ותדר יסוד',
  'mixer.styleTitle': 'אופי המלודיה',
  'mixer.density': 'צפיפות נגינה',
  'mixer.density.sparse': 'דלילה',
  'mixer.density.balanced': 'מאוזנת',
  'mixer.density.flowing': 'זורמת',
  'mixer.pace': 'קצב',
  'mixer.pace.still': 'נייח',
  'mixer.pace.drifting': 'זורם',
  'mixer.pace.pulsing': 'פועם',
  'mixer.pace.rhythmic': 'קצבי',
  'mixer.depth': 'עומק',
  'mixer.depth.clean': 'נקי',
  'mixer.depth.floating': 'מרחף',
  'mixer.depth.psychedelic': 'פסיכדלי',
  'mixer.depth.deep': 'עמוק',
  'mixer.depthNote': 'מעל חצי הסולם עובר לסדרת ההרמוניות העליונה — מרווחים של <ltr>7/4</ltr> ו-<ltr>11/8</ltr> שאין להם מקבילה בפסנתר. עדיין יחסים שלמים מדויקים של תדר היסוד.',
  'mixer.pulseNote': 'מעל "פועם" נכנסת פעימת בס על תדר היסוד, התווים מתקצרים והנגיעה נעשית נקישה במקום התנפחות.',
  'mixer.kickNote': ' הקיק עצמו הוא <ltr>{hz} Hz</ltr> מקופל אוקטבות מטה, כך שגם הצליל החזק ביותר במיקס הוא התדר שבחרת.',
  'mixer.kickNoteNoHz': ' הקיק עצמו הוא תדר היסוד מקופל אוקטבות מטה, כך שגם הצליל החזק ביותר במיקס הוא התדר שבחרת.',
  'mixer.beat': 'גל מוחי',
  'mixer.beatRate': 'קצב פעימה — {band}',
  'mixer.noBeat': 'שכבת הגל המוחי כבויה בהאזנה הזו. אפשר להוסיף טווח במסך התדרים.',
  'mixer.ambience': 'סאונד סביבה',
  'mixer.master': 'עוצמה כללית',

  'style.ambient': 'אמביינט',
  'style.techno': 'טכנו',
  'style.trance': 'טראנס',
  'style.psytrance': 'פסיטראנס',
  'style.deephouse': 'דיפ האוס',
  'style.techno.note': 'קיק על כל פעימה, בס מתחתיו, האט בין הפעימות וארפג׳ שמתחלף כל ארבע תיבות. הקיק כמעט אף פעם לא עוזב.',
  'style.trance.note': 'שש עשרה תיבות נהיגה, ברייקדאון שבו הקיק נעלם, בילד עם פילטר עולה ודרופ. הבס יושב בין הפעימות.',
  'style.psytrance.note': 'בס מתגלגל — הקיק לוקח את הפעימה והבס ממלא את שלושת השמיניות-עשרה שאחריה. 144 פעימות, האטים צפופים ופילטר עם רזוננס.',
  'style.deephouse.note': 'גרוב מתנדנד (שאפל), קיק רך, האט פתוח על השמינית המוקדמת, ואקורדים שנופלים בין הפעימות. בלי דרופים — זה מתגלגל.',

  'ambience.none': 'ללא',
  'ambience.rain': 'גשם',
  'ambience.ocean': 'ים',
  'ambience.wind': 'רוח',
  'ambience.brown': 'רעש חום',
  'ambience.pink': 'רעש ורוד',
  'ambience.white': 'רעש לבן',

  // ------------------------------------------------------------------ output
  'output.title': 'השמעה ומכשירים',
  'output.connecting': 'מחבר…',
  'output.switchDevice': 'החלף מכשיר',
  'output.castTo': 'השמע למכשיר בסביבה',
  'output.backToPhone': 'חזור להשמעה מהטלפון',
  'output.needPlaying': 'התחל נגינה כדי לבחור מכשיר.',
  'output.castFailed': 'לא הצלחתי להעביר את הצליל — חזרתי להשמעה מהטלפון כדי שלא תישאר בלי סאונד. אפשר לנסות גם ממרכז הבקרה.',
  'output.casting': 'משדר למכשיר חיצוני. שם הפריט והתדר הנוכחי מוצגים במכשיר.',
  'output.castIdle': 'שולח את ההאזנה לרמקול, לטלוויזיה או לרכב, עם שם התדר על המסך שלהם.',
  'output.noPicker': 'הדפדפן הזה לא חושף בורר מכשירים לדף עצמו. אפשר לנתב את הצליל דרך בקרת השמע של המכשיר — <b>מרכז הבקרה</b> בטלפון, או בורר פלט השמע במחשב.',
  'output.keepAwake': 'השאר את המסך דלוק',
  'output.wakeUnsupported': 'הדפדפן הזה לא תומך בנעילת מסך. אפשר להאריך את זמן הכיבוי בהגדרות המכשיר.',
  'output.wakeWillStart': 'יופעל כשתתחיל נגינה.',
  'output.wakeDenied': 'הבקשה נדחתה על ידי הדפדפן. בדרך כלל זה קורה כשהדף לא בחזית.',
  'output.wakeHeld': 'פעיל — המסך לא ייכבה בזמן ההאזנה.',
  'output.wakeIdle': 'מונע מהמסך לכבות באמצע האזנה. אינו מאפשר נגינה אחרי מעבר לאפליקציה אחרת.',

  // ------------------------------------------------------------------ themes
  'theme.start': 'התחלה',
  'theme.rest': 'שינה ורוגע',
  'theme.work': 'ריכוז ועבודה',
  'theme.motion': 'תנועה וקצב',
  'theme.inner': 'פנימי',
  'theme.intimacy': 'זוגיות',
  'theme.club': 'קלאב',
  'theme.psychedelic': 'פסיכדלי',
  'theme.start.blurb': 'הכי קצר להתחיל ממנו',
  'theme.rest.blurb': 'להוריד הילוך, להירדם, לשחרר מתח',
  'theme.work.blurb': 'להאזנה תוך כדי עבודה, ולהרמת אנרגיה',
  'theme.motion.blurb': 'פעימה קבועה — להליכה, למתיחות, לעמידה',
  'theme.inner.blurb': 'מדיטציה, התבוננות ויצירה',
  'theme.intimacy.blurb': 'ערב לשניים, מגע וקרבה',
  'theme.club.blurb': 'טכנו, טראנס, פסיטראנס ודיפ האוס — הקיק הוא התדר עצמו',
  'theme.psychedelic.blurb': 'הדים ארוכים ומרווחים לא מוכרים',

  // --------------------------------------------------------------- purposes
  'purpose.sleep': 'שינה',
  'purpose.focus': 'ריכוז',
  'purpose.spiritual': 'רוחני',
  'purpose.anxiety': 'חרדה',
  'purpose.intro': 'התחלה',
  'purpose.energy': 'אנרגיה',
  'purpose.creativity': 'יצירתיות',
  'purpose.body': 'גוף',
  'purpose.rhythm': 'קצבי',
  'purpose.psychedelic': 'פסיכדלי',
  'purpose.work': 'עבודה',
  'purpose.intimacy': 'זוגיות',
  'purpose.club': 'קלאב',

  // ------------------------------------------------------------------- about
  'about.title': 'אודות',
  'about.version': 'Resona · גרסה {v}',
  'about.byline': 'פותח ועוצב על ידי',
  'about.author': 'דודו טל',
  'about.footer': '© {year} דודו טל · Resona {v}',
} as const

export type StringKey = keyof typeof HE

const EN: Record<StringKey, string> = {
  'app.tagline': 'Frequencies & journeys',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.play': 'Play',
  'common.stop': 'Stop',
  'common.save': 'Save',
  'common.min': 'min',
  'common.minutes': 'minutes',
  'common.done': 'Done ✓',
  'common.dayN': 'Day {n}',
  'common.daysN': '{n} days',
  'common.dayOf': 'Day {n} of {total}',

  'nav.aria': 'Main navigation',
  'nav.home': 'Home',
  'nav.journeys': 'Journeys',
  'nav.frequencies': 'Frequencies',
  'nav.presets': 'Presets',
  'nav.settings': 'Settings',

  'splash.aria': 'Opening screen',
  'splash.tagline': 'Every ring is a harmonic interval of the same root frequency — and so is every note you hear.',
  'splash.start': 'Begin',
  'splash.tapAnywhere': 'Tap anywhere',

  'home.greet.night': 'Good night',
  'home.greet.morning': 'Good morning',
  'home.greet.afternoon': 'Good afternoon',
  'home.greet.evening': 'Good evening',
  'home.tagline': 'Music composed <accent>around</accent> the target frequency — not a tone parked beside it. Every note is derived mathematically from the frequency you choose.',
  'home.nowPlaying': 'Now playing',
  'home.continue': 'Resume listening',
  'home.activeJourney': 'Active journey',
  'home.myJourneys': 'My journeys',
  'home.journeyCount': '{n} guided journeys',
  'home.myPresets': 'My presets',
  'home.presetCount': '{n} saved',
  'home.noPresets': 'None saved yet',
  'home.browse': 'Browse frequencies',
  'home.browseSub': '<ltr>{roots}</ltr> root frequencies and <ltr>{bands}</ltr> brainwave bands — each with how well it is supported',
  'home.disclaimer': 'Resona is a tool for relaxation and listening only. It is not a medical device and not a substitute for professional advice. All data stays on your device.',

  'player.title': 'Player',
  'player.subtitle': 'The frequency, the melody and the layers',
  'player.infoAria': 'About this frequency',
  'player.change': 'Change frequency',
  'player.finishDay': 'Finish day',
  'player.saved': 'Saved ✓',
  'player.savePreset': 'Save preset',
  'player.pickerTitle': 'Choose a frequency',
  'player.saveTitle': 'Save a preset',
  'player.presetName': 'Preset name',
  'player.presetPlaceholder': '{root} for falling asleep',
  'player.saveNote': 'Saved with it: the root frequency, the brainwave band and its rate, the listening mode, the ambience, every layer level, the note density and the timer.',
  'player.finishTitle': 'How does it feel now?',
  'player.finishNote': 'Marks the day complete. The rating is stored locally and appears in the journey summary.',
  'player.defaultPresetName': 'Preset',

  'mini.remaining': ' · {clock} left',

  'tv.enter': 'TV mode',
  'tv.enterHint': 'Full screen with the visualiser alone — from there, screen mirroring puts it on the television.',
  'tv.exit': 'Exit',
  'player.mix': 'Mix',
  'player.mixTitle': 'Mix and session settings',
  'player.carrier': 'The pulse rides on <ltr>{carrier} Hz</ltr> — {relation} the root',
  'player.carrierSame': 'The pulse rides on the root itself',
  'relation.octaveDown': 'an octave below',
  'relation.twoOctavesDown': 'two octaves below',
  'relation.threeOctavesDown': 'three octaves below',
  'figure.pick': 'Figures',
  'figure.pickTitle': 'Choose a figure',
  'history.title': 'Recent sessions',
  'history.empty': 'Nothing listened to yet. What you play will show up here.',
  'history.clear': 'Clear history',
  'history.minutes': '<ltr>{n}</ltr> min',
  'history.today': 'Today',
  'history.yesterday': 'Yesterday',
  'history.daysAgo': '<ltr>{n}</ltr> days ago',
  'figure.chakras': 'Chakras',
  'figure.spectrum': 'Spectrum',
  'figure.violet': 'Violet',
  'figure.starlight': 'Starlight',
  'figure.temple': 'Temple',
  'figure.cosmos': 'Cosmos',
  'figure.crimson': 'Crimson',
  'figure.forest': 'Forest',
  'figure.jupiter': 'Jupiter',
  'figure.emerald': 'Emerald',
  'figure.amber': 'Amber',
  'figure.scene': '3D',
  'tv.mirror': 'To the television: Control Centre → Screen Mirroring → pick the television. Picture and sound both go across, so leave the output here on the phone rather than on AirPlay.',
  'tv.rotate': 'Turn the phone sideways — mirroring sends the screen as it is, and sideways it fills the television.',
  'tv.hint': 'Tap for the controls · Esc to exit',

  'timer.label': 'Timer',
  'timer.fading': 'The fade has begun — the level drops gradually into silence.',
  'timer.fadeNote': 'At the end of the timer the level fades over {seconds} seconds instead of cutting out.',
  'timer.15': '15 minutes',
  'timer.30': '30 minutes',
  'timer.60': '1 hour',
  'timer.120': '2 hours',
  'timer.untilMorning': 'Until morning',
  'timer.unlimited': 'No limit',
  'timer.custom': 'Custom',

  'listen.headphones': 'Headphones',
  'listen.headphonesHint': 'Binaural — each ear gets a slightly different frequency',
  'listen.speakers': 'Speakers',
  'listen.speakersHint': 'Isochronic — one pulsed tone, works on any output',
  'listen.question': 'How are you listening?',
  'listen.savedForLater': 'Saved for later',
  'listen.groupAria': 'Listening mode',
  'listen.binauralWarning': 'A binaural beat exists only in the difference between your ears. On speakers the two tones mix in the air and the effect never forms — plug in headphones, or choose speakers.',
  'listen.noBeatNote': 'This session has no brainwave layer, so the choice does not change what you hear right now — the melody is identical on headphones and speakers. It is remembered and applies to every session that does include a band.',

  'notice.title': 'Before you start',
  'notice.intro': 'The brainwave layer can run in two ways:',
  'notice.isoTitle': 'Isochronic — the default',
  'notice.isoBody': 'A single tone pulsed at the chosen rate. Works on speakers, on headphones, on anything.',
  'notice.binTitle': 'Binaural — headphones required',
  'notice.binBody': 'Each ear gets a slightly different frequency and the brain fills in the difference. On speakers the two tones mix in the air and the effect simply never forms — which is why it is not the default.',
  'notice.footer': 'A browser cannot detect whether headphones are plugged in, so the choice stays yours. You can switch at any time in the mixer. If you have epilepsy or a sensitivity to rhythmic stimulation, consult a doctor before using this layer.',
  'notice.chooseBinaural': 'I have headphones — binaural',
  'notice.chooseIso': 'Continue with isochronic',

  'mood.1': 'Hard',
  'mood.2': 'Not great',
  'mood.3': 'Okay',
  'mood.4': 'Good',
  'mood.5': 'Excellent',

  'journeys.title': 'Journeys',
  'journeys.subtitle': '{n} programmes, grouped by theme',
  'journeys.all': 'All',
  'journeys.ascending': 'Rises through the scale',
  'journeys.descending': 'Descends through the scale',
  'journeys.startsWith': 'Starts with ',
  'journeys.footer': 'A journey is a suggested listening structure, not a treatment protocol. You can skip between days at any point, and you can add your own in <ltr>src/data/journeys.json</ltr>.',
  'journey.notFound': 'Journey not found',
  'journey.notFoundBody': 'This journey is no longer in the catalogue.',
  'journey.ascendingMark': '↑ rises through the scale',
  'journey.descendingMark': '↓ descends through the scale',
  'journey.listenAgain': 'Listen again',
  'journey.continue': 'Continue — day {n}',
  'journey.start': 'Start journey',
  'journey.resetConfirm': 'Reset your progress in this journey?',
  'journey.reset': 'Reset progress',
  'journey.today': 'Your day',

  'day.notFound': 'Day not found',
  'day.notFoundBody': 'This journey has no such day.',
  'day.supporting': 'A supporting brainwave band runs underneath — ',
  'day.supportingTail': ', at a low level so the day’s own frequency stays in front.',
  'day.start': 'Start the day',
  'day.again': 'Listen to this day again',
  'day.whatIsClaimed': 'What is attributed to this frequency?',
  'day.howDidYouFeel': 'How did it feel afterwards?',
  'day.moodDone': 'You can change the rating at any time. Everything stays on this device.',
  'day.moodNew': 'Rating marks the day complete and moves you to the next one.',

  'presets.title': 'My presets',
  'presets.subtitle': 'Saved combinations, reloaded exactly as they were',
  'presets.emptyTitle': 'No presets yet',
  'presets.emptyBody': 'Build a combination in the player — frequency, layers, levels and timer — and save it under a name.',
  'presets.toPlayer': 'Go to the player',
  'presets.playAria': 'Play {name}',
  'presets.editAria': 'Edit {name}',
  'presets.deleteAria': 'Delete {name}',
  'presets.deleteConfirm': 'Delete “{name}”?',
  'presets.editTitle': 'Edit preset',
  'presets.name': 'Name',
  'presets.saveName': 'Save name',
  'presets.updateToCurrent': 'Update to the current mixer settings',
  'presets.unnamed': 'Untitled preset',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageHint': 'Changes the whole interface, the frequency names and the journey content.',
  'settings.theme': 'Theme',
  'settings.themeHint': 'Black is true black — no frost, sharper colour — and on an OLED screen those pixels are genuinely off.',
  'settings.theme.dark': 'Dark',
  'settings.theme.noir': 'Black',
  'settings.theme.light': 'Light',
  'settings.reducedMotion': 'Reduce motion',
  'settings.reducedMotionHint': 'Calms the visualiser and the aurora background — better before sleep, or with motion sensitivity.',
  'settings.localData': 'Local data',
  'settings.localDataBody': 'The app has no server, no account and no sync. Presets, journey progress and settings live in this browser’s localStorage only — clearing browser data deletes them.',
  'settings.resetAll': 'Reset all local data',
  'settings.resetConfirm': 'Reset all local data? Presets and journey progress will be permanently deleted.',
  'settings.wiped': 'Data deleted',
  'settings.about': 'About',
  'settings.aboutHint': 'How the app works, background playback, privacy, transparency and credits',

  'freq.title': 'Frequencies',
  'freq.subtitle': 'Choose a root frequency and a brainwave band — tap ⓘ to see what each claim rests on',
  'freq.play': 'Play',
  'freq.rootTitle': 'Root frequency',
  'freq.rootHint': 'Every note in the melody derives from it',
  'freq.beatsTitle': 'Brainwave bands',
  'freq.beatsHint': 'Slowest to fastest',
  'freq.noBeat': 'No brainwave layer',
  'freq.infoAria': 'About {name}',
  'freq.group.solfeggio': 'The solfeggio scale',
  'freq.group.solfeggioNote': 'Nine tones from tradition, low to high',
  'freq.group.tuning': 'Tunings',
  'freq.group.tuningNote': 'Musical standards — including 440Hz itself, for comparison',
  'freq.group.cosmic': 'The cosmic octave',
  'freq.group.cosmicNote': 'Measured cycles and resonances, doubled by octaves into hearing range',

  'info.claimed': 'What is attributed to it',
  'info.howItSounds': 'How the frequency sounds here',
  'info.howItSoundsBody': 'The frequency is not parked in the background as a separate tone. It is the root of the scale — every note in the melody is <ltr>{hz} Hz</ltr> multiplied by a pure harmonic ratio (such as <ltr>3/2</ltr> or <ltr>5/4</ltr>), so the music itself is built out of the frequency rather than merely sitting next to it.',
  'info.disclaimer': 'Resona is a tool for relaxation and listening. It is not a medical device, does not diagnose or treat any condition, and is not a substitute for professional advice. If you have epilepsy, a sensitivity to rhythmic stimulation, or a neurological condition, consult a doctor before using the brainwave layer.',
  'type.solfeggio': 'Traditional solfeggio scale',
  'type.tuning': 'Musical tuning',
  'type.cosmic': 'A measured cycle, doubled by octaves',
  'type.binaural': 'Brainwave band',

  'trust.traditional': 'Traditional',
  'trust.research_backed_partial': 'Partial evidence',
  'trust.reference': 'Reference',
  'trust.traditional.notice': 'Based on tradition and cultural belief; not supported by clinical scientific evidence.',
  'trust.research_backed_partial.notice': 'Some research evidence exists, and it is partial and inconsistent.',
  'trust.reference.notice': 'A reference tuning in general use. It carries no claim of any effect.',

  'mixer.melody': 'Melody & root frequency',
  'mixer.styleTitle': 'Melody character',
  'mixer.density': 'Note density',
  'mixer.density.sparse': 'Sparse',
  'mixer.density.balanced': 'Balanced',
  'mixer.density.flowing': 'Flowing',
  'mixer.pace': 'Pace',
  'mixer.pace.still': 'Still',
  'mixer.pace.drifting': 'Drifting',
  'mixer.pace.pulsing': 'Pulsing',
  'mixer.pace.rhythmic': 'Rhythmic',
  'mixer.depth': 'Depth',
  'mixer.depth.clean': 'Clean',
  'mixer.depth.floating': 'Floating',
  'mixer.depth.psychedelic': 'Psychedelic',
  'mixer.depth.deep': 'Deep',
  'mixer.depthNote': 'Past halfway the scale switches to the upper harmonic series — intervals of <ltr>7/4</ltr> and <ltr>11/8</ltr> that have no equivalent on a piano. Still exact whole-number ratios of the root frequency.',
  'mixer.pulseNote': 'Above “pulsing” a bass pulse on the root frequency comes in, notes shorten, and the touch becomes a pluck rather than a swell.',
  'mixer.kickNote': ' The kick itself is <ltr>{hz} Hz</ltr> folded down by octaves, so even the loudest thing in the mix is the frequency you chose.',
  'mixer.kickNoteNoHz': ' The kick itself is the root frequency folded down by octaves, so even the loudest thing in the mix is the frequency you chose.',
  'mixer.beat': 'Brainwave layer',
  'mixer.beatRate': 'Beat rate — {band}',
  'mixer.noBeat': 'The brainwave layer is off for this session. You can add a band on the frequencies screen.',
  'mixer.ambience': 'Ambience',
  'mixer.master': 'Master volume',

  'style.ambient': 'Ambient',
  'style.techno': 'Techno',
  'style.trance': 'Trance',
  'style.psytrance': 'Psytrance',
  'style.deephouse': 'Deep house',
  'style.techno.note': 'A kick on every beat, bass underneath it, hats between the beats, and an arpeggio that is redrawn every four bars. The kick almost never leaves.',
  'style.trance.note': 'Sixteen bars of drive, a breakdown where the kick disappears, a build with a rising filter, and a drop. The bass sits between the kicks.',
  'style.psytrance.note': 'A rolling bass — the kick takes the beat and the bass fills the three 16ths after it. 144 BPM, dense hats and a resonant filter.',
  'style.deephouse.note': 'A shuffled groove, a soft kick, an open hat on the offbeat eighth, and chords landing between the beats. No drops — it rolls.',

  'ambience.none': 'None',
  'ambience.rain': 'Rain',
  'ambience.ocean': 'Ocean',
  'ambience.wind': 'Wind',
  'ambience.brown': 'Brown noise',
  'ambience.pink': 'Pink noise',
  'ambience.white': 'White noise',

  'output.title': 'Playback & devices',
  'output.connecting': 'Connecting…',
  'output.switchDevice': 'Switch device',
  'output.castTo': 'Play on a nearby device',
  'output.backToPhone': 'Back to playing from this phone',
  'output.needPlaying': 'Start playback to choose a device.',
  'output.castFailed': 'I could not move the sound across — I switched back to playing from the phone so you would not be left with silence. You can also try from Control Centre.',
  'output.casting': 'Casting to an external device. The item name and the current frequency are shown on it.',
  'output.castIdle': 'Sends the session to a speaker, a TV or a car, with the frequency name on their screen.',
  'output.noPicker': 'This browser does not expose a device picker to the page itself. You can route the sound through the device’s own audio controls — <b>Control Centre</b> on a phone, or the audio output picker on a computer.',
  'output.keepAwake': 'Keep the screen on',
  'output.wakeUnsupported': 'This browser does not support a screen wake lock. You can extend the screen timeout in your device settings.',
  'output.wakeWillStart': 'Will engage when playback starts.',
  'output.wakeDenied': 'The browser refused the request. That usually happens when the page is not in the foreground.',
  'output.wakeHeld': 'Active — the screen will not switch off while you listen.',
  'output.wakeIdle': 'Stops the screen from switching off mid-session. It does not allow playback after switching to another app.',

  'theme.start': 'Getting started',
  'theme.rest': 'Sleep & calm',
  'theme.work': 'Focus & work',
  'theme.motion': 'Movement & rhythm',
  'theme.inner': 'Inner',
  'theme.intimacy': 'Together',
  'theme.club': 'Club',
  'theme.psychedelic': 'Psychedelic',
  'theme.start.blurb': 'The shortest way in',
  'theme.rest.blurb': 'Wind down, fall asleep, release tension',
  'theme.work.blurb': 'For listening while working, and for lifting energy',
  'theme.motion.blurb': 'A steady pulse — for walking, stretching, standing',
  'theme.inner.blurb': 'Meditation, reflection and making things',
  'theme.intimacy.blurb': 'An evening for two, touch and closeness',
  'theme.club.blurb': 'Techno, trance, psytrance and deep house — the kick is the frequency itself',
  'theme.psychedelic.blurb': 'Long echoes and unfamiliar intervals',

  'purpose.sleep': 'Sleep',
  'purpose.focus': 'Focus',
  'purpose.spiritual': 'Spiritual',
  'purpose.anxiety': 'Anxiety',
  'purpose.intro': 'Getting started',
  'purpose.energy': 'Energy',
  'purpose.creativity': 'Creativity',
  'purpose.body': 'Body',
  'purpose.rhythm': 'Rhythmic',
  'purpose.psychedelic': 'Psychedelic',
  'purpose.work': 'Work',
  'purpose.intimacy': 'Together',
  'purpose.club': 'Club',

  'about.title': 'About',
  'about.version': 'Resona · version {v}',
  'about.byline': 'Built and designed by',
  'about.author': 'Dudu Tal',
  'about.footer': '© {year} Dudu Tal · Resona {v}',
}

export const STRINGS: Record<Lang, Record<StringKey, string>> = { he: HE, en: EN }

export type Vars = Record<string, string | number>

function fill(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  return fill(STRINGS[lang][key], vars)
}

/**
 * Renders the small amount of markup the copy needs.
 *
 * Some sentences have to emphasise a word or force a run of digits to read
 * left-to-right inside a right-to-left paragraph. Rather than splitting those
 * sentences across several dictionary keys — which makes them untranslatable,
 * because word order differs between the languages — the copy carries three
 * tags and they are turned into elements here.
 */
const TAG = /<(b|ltr|accent)>([\s\S]*?)<\/\1>/g

export function renderRich(text: string): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(TAG)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    const [, tag, inner] = m
    if (tag === 'b') out.push(createElement('strong', { key: key++ }, inner))
    // `<ltr>` only ever wraps a quantity in these strings — a frequency, a rate,
    // a count of minutes — so it carries the readout face with it.
    else if (tag === 'ltr') out.push(createElement('span', { key: key++, className: 'readout' }, inner))
    else out.push(createElement('span', { key: key++, style: { color: 'var(--accent)' } }, inner))
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return createElement(Fragment, null, ...out)
}

/** Everything a component needs to render in the current language. */
const RICH_TAG = /<(b|ltr|accent)>/

export function useT() {
  const lang = useSettings((s) => s.lang)
  return {
    lang,
    dir: DIR[lang],
    /**
     * Plain text. In development it complains if the string it resolved still
     * carries rich-text markup, because that is always a mistake at the call
     * site and it is invisible in review: the tags simply render as characters,
     * so a history row read "<ltr>1</ltr> min" in the shipped UI until someone
     * looked at it. The end-to-end runs already fail on console errors, so this
     * turns a silent typo into a caught one.
     */
    t: (key: StringKey, vars?: Vars) => {
      const text = translate(lang, key, vars)
      if (import.meta.env.DEV && RICH_TAG.test(text)) {
        console.error(`i18n: "${key}" contains rich markup — use rich() rather than t()`)
      }
      return text
    },
    rich: (key: StringKey, vars?: Vars) => renderRich(translate(lang, key, vars)),
  }
}
