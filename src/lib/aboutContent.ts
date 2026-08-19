import type { Lang } from './i18n'

/**
 * The About screen, in both languages.
 *
 * It lives here rather than in the string dictionary because it is prose, not
 * labels: whole sections that have to be written and edited as a piece. The
 * paragraphs carry the same `<b>` and `<ltr>` tags the dictionary uses, so they
 * render through the same helper.
 *
 * Section shapes are identical between the languages, and the test asserts it —
 * a section added to one and forgotten in the other is exactly the kind of gap
 * that turns a "full second language" into a half-translated app.
 */
export type AboutSection = { title: string; paragraphs: string[] }

const HE: AboutSection[] = [
  {
    title: 'מה זה',
    paragraphs: [
      'Resona מנגן מוזיקה שנוצרת בזמן אמת סביב תדר יעד שאתה בוחר — סולפג׳יו, כוונונים חלופיים, האוקטבה הקוסמית וטווחי גלי מוח. אפשר לערבב שלוש שכבות, לשמור פריסטים, ולעבור מסעות מודרכים רב-יומיים.',
      'כרגע יש באפליקציה <ltr>{roots}</ltr> תדרי יסוד, <ltr>{bands}</ltr> טווחי גלי מוח ו-<ltr>{journeys}</ltr> מסעות.',
    ],
  },
  {
    title: 'הרעיון — עיגון',
    paragraphs: [
      'ברוב האפליקציות התדר והמוזיקה הם שני דברים נפרדים: או מוזיקה נעימה בלי תדר מוצהר, או טון מתמשך שאינו מוזיקה. כאן התדר שבחרת הוא <b>תדר היסוד שממנו המלודיה נגזרת</b>.',
      'כל תו שתשמע הוא התדר כפול יחס הרמוני טהור — <ltr>3/2</ltr>, <ltr>5/4</ltr>, <ltr>9/8</ltr> — כפול חזקה של שתיים. לא קיים באפליקציה צליל שאינו יחס שלם של התדר שבחרת, וזה נבדק אוטומטית בכל שינוי בקוד.',
      'המלודיה נבנית מחדש בכל האזנה דרך הליכה הסתברותית על דרגות הסולם. אין קובץ מוזיקה ואין לופ — ולכן אין שתי האזנות זהות, גם באותו תדר.',
    ],
  },
  {
    title: 'קלאב — שישה מנועים',
    paragraphs: [
      'למדף הזה יש מנוע נפרד, וכאן ההבטחה על "בלי לופ" נפרדת בכוונה. באמביינט הסדירות היא הבעיה; כאן היא הצורה. קיק שיוצא מהמשבצת אינו טראק מעניין יותר — הוא טראק שבור. לכן יש רשת אמיתית: שעון של שמינית-עשרה, מונה תיבות, וקטעים שמדליקים ומכבים כלים. מה שכן לא חוזר הוא החומר — הפיגורה נכתבת מחדש כל ארבע תיבות.',
      '<b>הקיק הוא התדר.</b> אין דגימות ואין ספריית תופים — הקיק מסונתז על תדר היעד מקופל אוקטבות מטה. ב-528Hz הוא <ltr>66 Hz</ltr>, ב-396Hz הוא <ltr>49.5 Hz</ltr>. הצליל החזק ביותר במיקס הוא התדר שבחרת.',
      'מה שמבדיל בין הארבעה זה לא הטמפו — זה החלק הקל. זה איפה הבס יושב ביחס לקיק: <b>טכנו</b> מתחתיו, <b>טראנס</b> בין הפעימות, <b>פסיטראנס</b> מתגלגל דרך שלוש השמיניות-עשרה שאחרי כל קיק, ו<b>דיפ האוס</b> ארוך ומסונקף. ואז — האם השמיניות-עשרה ישרות או מתנדנדות (רק דיפ האוס מתנדנד), האם ההרמוניה מפורקת לארפג׳ או נוחתת כאקורד מלא (רק דיפ האוס), והאם הסידור בכלל מרשה לעצמו להפיל את הרחבה. טראנס ופסיטראנס עושים ברייקדאון ודרופ; טכנו כמעט אף פעם לא עוזב את הקיק; דיפ האוס לא מפיל כלום, הוא פשוט מתגלגל.',
      'סרגל "עומק" מזיז את ההרמוניה לדרגות שהאקורד מדלג עליהן — בסדרה ההרמונית העליונה אלו <ltr>11/8</ltr>, <ltr>13/8</ltr> ו-<ltr>7/4</ltr>. זה מה שהופך פסיטראנס לפסיכדלי ודיפ האוס לאקורדים שנשמעים מוכרים ולא מוכרים בו-זמנית.',
      'שניים נוספו מאוחר יותר ואינם וריאציות טמפו. <b>אורגני האוס</b> הוא דיפ האוס שמנוגן בידיים: שאפל עמוק יותר, קיק רך שמרגישים ולא שומעים, וכלי הקשה מעץ במקום מחיאה — התבנית שלהם חוזרת כל שלוש שמיניות-עשרה מול תיבה של ארבע, כך שהיא מטיילת סביב הגריד ונוחתת בכל פעם במקום אחר. זה החיקוי הזול והכן ביותר של מישהו שלא סופר. <b>טריפי</b> אינו למועדון בכלל: 104 פעימות, קיק שמסמן זמן במקום להוביל, דיליי דאב על שמינית מנוקדת שלעולם לא מתיישר עם הפעימה, ומחזור של 32 תיבות בלי בילד ובלי דרופ — כי כל דבר שנפתר מחזיר אותך לספור.',
      'יש כאן פעימה קצבית חזקה וקבועה. במקרה של אפילפסיה או רגישות לגירוי קצבי — כדאי להיוועץ ברופא לפני שימוש במדף הזה.',
    ],
  },
  {
    title: 'פריטה — מיתר במקום נשימה',
    paragraphs: [
      'סגנון שלישי, שאינו אמביינט ואינו קלאב. אין בו רשת, אין קיק, ואין שום דבר שעולה בעוצמה — יש מיתר שנפרט ונשאר לדעוך. אלו אותן פרזות חופשיות של האמביינט, על אותו סולם ואותו עיגון, רק צפופות יותר: צליל פריטה נגמר תוך שנייה וחצי, ובמרווחים של האמביינט הוא היה יוצא נקישות בודדות עם שקט ביניהן.',
      'הוא לא מסונתז כמעטפת אחרת על אותו אוסילטור, כי זה לא היה עובד — <b>הגוף</b> שגוי, לא רק צורת ההתקפה. זהו מודל קרפלוס-סטרונג: עירור אמיתי ודעיכה אמיתית. הפריטה החזקה גם בהירה יותר, כמו בכלי אמיתי, במקום להישאר באותו גוון ורק להתחזק.',
    ],
  },
  {
    title: 'נגינה ברקע ובמכשירים אחרים',
    paragraphs: [
      '<b>ניתוב למכשיר חיצוני:</b> בספארי יש כפתור "השמע למכשיר בסביבה" במסך הנגן — הוא מעביר את ההאזנה לרמקול, לטלוויזיה או לרכב, ומציג שם את התדר הנוכחי. אם ההעברה לא מצליחה, האפליקציה חוזרת מיד להשמעה מהטלפון במקום להישאר בלי צליל, ואפשר לחזור ידנית בכל רגע.',
      '<b>השם שמופיע במכשיר:</b> מערכת ההפעלה מוסרת את כרטיס "מתנגן כעת" רק לדף שיש בו נגן מדיה פעיל. מנוע אודיו לבדו לא תופס אותו, ולכן קודם לכן הוצג שם האפליקציה שהחזיקה בו לפני כן — לרוב Apple Music. Resona מנגן כעת גם קובץ שקט קצר ברקע כדי לתפוס את הכרטיס, וכך התדר הנוכחי הוא מה שמוצג במסך הנעילה וביעד ההשמעה.',
      '<b>העטיפה:</b> במקום אייקון קבוע, האפליקציה מציירת לכל האזנה תמונת עטיפה משלה — התדר במרכז, טבעות הרמוניות בצבע התדר, ובמסע גם שם המסע והשלב שבו אתה נמצא. היא נוצרת במכשיר בזמן ההפעלה ואינה קובץ שנטען מהרשת.',
      '<b>מעבר לאפליקציה אחרת:</b> כאן יש מגבלה אמיתית שחשוב להכיר. דפדפנים בטלפון — ובמיוחד ספארי באייפון — משהים את מנוע האודיו ברגע שעוזבים את הדף, ואין לאפליקציית ווב שום דרך לבקש חריגה מזה. זו מגבלת מערכת הפעלה, לא באג.',
      'מה שכן עובד: הפעלת "השאר את המסך דלוק" במסך הנגן מונעת מהמסך לכבות, וכך ההאזנה נמשכת ברצף כל עוד נשארים באפליקציה. זהו <b>לא</b> מתג לנגינה ברקע — הוא לא יעזור אחרי מעבר לאפליקציה אחרת, והמתג עצמו יגיד לך אם הדפדפן דחה את הבקשה במקום להיראות דלוק לשווא.',
    ],
  },
  {
    title: 'שפה',
    paragraphs: [
      'הממשק קיים במלואו בעברית ובאנגלית, ואפשר להחליף בכל רגע במסך ההגדרות. ההחלפה משנה גם את שמות התדרים, את תוכן המסעות ואת מה שמוצג במסך הנעילה — לא רק את הכפתורים.',
      'עברית היא ברירת המחדל ושפת המקור. באנגלית הדף עובר לכיוון שמאל-לימין, כולל החצים והיישור.',
    ],
  },
  {
    title: 'פרטיות',
    paragraphs: [
      'אין חשבון, אין הרשמה, אין שרת ואין מעקב. הפריסטים, התקדמות המסעות וההגדרות נשמרים ב-localStorage של הדפדפן במכשיר שלך בלבד, ולא נשלחים לשום מקום.',
      'אחרי הטעינה הראשונה האפליקציה עובדת אופליין במלואה — מנוע האודיו מסנתז הכול מקומית ואינו פונה לרשת בזמן נגינה.',
    ],
  },
  {
    title: 'שקיפות',
    paragraphs: [
      'לכל תדר באפליקציה מוצמדת רמת ביסוס, והיא מוצגת בכל מקום שבו התדר מופיע — לא מוסתרת בעמוד תנאים.',
      'תדרי הסולפג׳יו, הכוונונים החלופיים והאוקטבה הקוסמית מסומנים כ<b>מסורתיים</b>: מבוססי מסורת ואמונה תרבותית, ללא ראיות מדעיות קליניות. טווחי גלי המוח הסטנדרטיים מסומנים כבעלי <b>ראיות חלקיות</b>: נחקרו, עם ממצאים לא עקביים.',
      'יש גם סימון שלישי, <b>ייחוס</b>, לערכים שאינם טוענים דבר. כוונון <ltr>A=440Hz</ltr> נמצא באפליקציה בדיוק בשביל זה — כדי שתוכל לשמוע את אותה מלודיה ב-440 ומיד אחר כך ב-432 ולהחליט בעצמך. לסמן אותו כ"מסורתי" היה פשוט לא נכון, ושקיפות ששקרה לצד אחד שווה בדיוק כמו שקיפות ששקרה לצד השני.',
      'מאותה סיבה תהודת שומאן מסומנת כ<b>מסורתית</b> ולא כמבוססת מחקר: התופעה הפיזיקלית עצמה אמיתית ונמדדת, אבל הקישור בינה לבין השפעה על גוף או תודעה הוא פרשנות.',
      'Resona הוא כלי להרפיה והאזנה. אינו מכשיר רפואי, אינו מאבחן ואינו מטפל, ואינו תחליף לייעוץ מקצועי. במקרה של אפילפסיה, רגישות לגירוי קצבי או מצב נוירולוגי — כדאי להיוועץ ברופא לפני שימוש בשכבת הגלים המוחיים.',
    ],
  },
  {
    title: 'איך זה בנוי',
    paragraphs: [
      'אפליקציית ווב (PWA) שרצה כולה בדפדפן. React ו-TypeScript לממשק, Tone.js למנוע האודיו, Tailwind לעיצוב. הוויזואליזציה והמסך הפותח מצוירים ב-Canvas לפי צפיפות הפיקסלים של המסך.',
      '<b>הוויזואליזציה בנגן</b> היא אותה תמונה של מסך הפתיחה, רק שהטבעות כבר לא רק מקשטות: כל טבעת מכוונת למרווח שלה וקוראת את הספקטרום בדיוק בגובה הזה. כשהמוזיקה מנגנת קווינטה, הטבעת של <ltr>3/2</ltr> היא זו שנדלקת. במדידה מול תדרים שהונחו בכוונה מחוץ לסולם, ב-260 פריימים מתוך 260 המרווח מהסולם נקרא חזק יותר — הטיה אמיתית, לא ספקטרוגרף.',
      '<b>ערכת "שחור"</b> אינה "כהה יותר" אלא רקע אחר: שחור אמיתי בלי גוון, בלי זיגוג — כך שקצוות נוחתים על הפיקסל במקום בתוך טשטוש — והצבעים מוגברים כי על שחור אין אור סביבה שירים אותם. הטבעות מצוירות שם בערבוב חיבורי, כך שזוהרים מצטברים לאור במקום ללכלך זה את זה.',
      'גם סאונדי הסביבה — גשם, ים, רוח, רעש — מסונתזים ואינם קבצי אודיו, ולכן אין בהם לופ.',
    ],
  },
]

const EN: AboutSection[] = [
  {
    title: 'What this is',
    paragraphs: [
      'Resona plays music generated in real time around a target frequency you choose — solfeggio tones, alternative tunings, the cosmic octave and brainwave bands. You can mix three layers, save presets, and follow multi-day guided journeys.',
      'The app currently holds <ltr>{roots}</ltr> root frequencies, <ltr>{bands}</ltr> brainwave bands and <ltr>{journeys}</ltr> journeys.',
    ],
  },
  {
    title: 'The idea — anchoring',
    paragraphs: [
      'In most apps the frequency and the music are two separate things: either pleasant music with no declared frequency, or a sustained tone that is not music. Here the frequency you choose is <b>the root the melody is derived from</b>.',
      'Every note you hear is that frequency multiplied by a pure harmonic ratio — <ltr>3/2</ltr>, <ltr>5/4</ltr>, <ltr>9/8</ltr> — times a power of two. No sound exists in this app that is not a whole-number ratio of the frequency you picked, and that is checked automatically on every change to the code.',
      'The melody is rebuilt on every listen through a probabilistic walk over the degrees of the scale. There is no audio file and no loop — so no two sessions are the same, even at the same frequency.',
    ],
  },
  {
    title: 'Club — six engines',
    paragraphs: [
      'This shelf has its own engine, and the "no loop" promise is deliberately different here. In ambient, regularity is the problem; here it is the form. A kick that wanders off the grid is not a more interesting track, it is a broken one. So there is a real grid: a 16th-note clock, a bar counter, and sections that turn instruments on and off. What still refuses to repeat is the material — the figure is rewritten every four bars.',
      '<b>The kick is the frequency.</b> No samples and no drum library — the kick is synthesised on the target frequency folded down by octaves. At 528Hz it is <ltr>66 Hz</ltr>; at 396Hz it is <ltr>49.5 Hz</ltr>. The loudest thing in the mix is the frequency you chose.',
      'What separates the four is not the tempo — that is the easy part. It is where the bass sits against the kick: <b>techno</b> under it, <b>trance</b> between the beats, <b>psytrance</b> rolling through the three 16ths after every kick, and <b>deep house</b> long and syncopated. Then: whether the off-16ths are straight or shuffled (only deep house shuffles), whether the harmony is arpeggiated or lands as a full chord (only deep house), and whether the arrangement is allowed to tear the floor down at all. Trance and psytrance break down and drop; techno almost never lets go of the kick; deep house drops nothing, it simply rolls.',
      'The "depth" slider moves the harmony onto the degrees a chord steps over — in the upper harmonic series those are <ltr>11/8</ltr>, <ltr>13/8</ltr> and <ltr>7/4</ltr>. That is what makes psytrance psychedelic, and what makes deep-house chords sound familiar and unfamiliar at the same time.',
      'Two were added later and are not tempo variations. <b>Organic house</b> is deep house played by hands: a deeper shuffle, a soft kick felt rather than heard, and wooden percussion instead of a clap — their pattern repeats every three sixteenths against a bar of four, so it walks around the grid and lands somewhere different each time. That is the cheapest honest imitation of a player who is not counting. <b>Trippy</b> is not for a club at all: 104 BPM, a kick that marks time rather than leading, a dotted-eighth dub delay that never lines up with the beat, and a 32-bar cycle with no build and no drop — because anything that resolves puts you back to counting.',
      'There is a strong, constant rhythmic pulse here. If you have epilepsy or a sensitivity to rhythmic stimulation, consult a doctor before using this shelf.',
    ],
  },
  {
    title: 'Plucked — a string instead of a breath',
    paragraphs: [
      'A third style, neither ambient nor club. No grid, no kick, and nothing that swells — a string is plucked and left to decay. These are the same free phrases as ambient, on the same scale and the same anchoring, only packed closer together: a plucked note is gone in a second and a half, and at ambient’s spacing it came out as isolated pings with silence between them.',
      'It is not the same oscillator under a different envelope, because that does not work — the <b>body</b> is wrong, not just the shape of the attack. This is a Karplus-Strong model: a real excitation and a real decay. A harder pluck is also a brighter one, as on a real instrument, rather than the same timbre turned up.',
    ],
  },
  {
    title: 'Background playback and other devices',
    paragraphs: [
      '<b>Routing to an external device:</b> in Safari there is a "Play on a nearby device" button on the player screen — it moves the session to a speaker, a TV or a car, and shows the current frequency there. If the handover fails, the app returns to playing from the phone immediately rather than leaving you in silence, and you can switch back manually at any time.',
      '<b>The name shown on the device:</b> the operating system hands the "now playing" card only to a page with an active media element. An audio engine alone does not claim it, which is why the name previously shown was whatever app held it before — usually Apple Music. Resona now also plays a short silent file in the background to claim the card, so the current frequency is what appears on the lock screen and at the playback target.',
      '<b>The cover art:</b> instead of a fixed icon, the app draws its own cover for every session — the frequency at the centre, harmonic rings in the frequency’s colour, and during a journey the journey’s name and the stage you are on. It is drawn on the device at playback time and is not a file fetched from the network.',
      '<b>Switching to another app:</b> here there is a real limitation worth knowing. Mobile browsers — Safari on iPhone especially — suspend the audio engine the moment you leave the page, and a web app has no way to ask for an exception. That is an operating-system limit, not a bug.',
      'What does work: turning on "Keep the screen on" in the player stops the screen switching off, so a session runs unbroken as long as you stay in the app. It is <b>not</b> a background-playback switch — it will not help after you move to another app, and the switch itself tells you if the browser refused, rather than looking enabled for nothing.',
    ],
  },
  {
    title: 'Language',
    paragraphs: [
      'The interface exists in full in Hebrew and in English, and you can switch at any time in Settings. Switching also changes the frequency names, the journey content and what appears on the lock screen — not just the buttons.',
      'Hebrew is the default and the original. In English the page switches to left-to-right, arrows and alignment included.',
    ],
  },
  {
    title: 'Privacy',
    paragraphs: [
      'No account, no sign-up, no server and no tracking. Presets, journey progress and settings are stored in your browser’s localStorage on your device only, and are never sent anywhere.',
      'After the first load the app works fully offline — the audio engine synthesises everything locally and makes no network requests while playing.',
    ],
  },
  {
    title: 'Transparency',
    paragraphs: [
      'Every frequency in the app carries a level of support, shown everywhere the frequency appears — not buried in a terms page.',
      'The solfeggio tones, the alternative tunings and the cosmic octave are marked <b>traditional</b>: based on tradition and cultural belief, without clinical scientific evidence. The standard brainwave bands are marked as having <b>partial evidence</b>: studied, with inconsistent findings.',
      'There is a third marking, <b>reference</b>, for values that claim nothing at all. The <ltr>A=440Hz</ltr> tuning is in the app for exactly that reason — so you can hear the same melody at 440 and then immediately at 432 and decide for yourself. Marking it "traditional" would simply have been false, and transparency that lies in the flattering direction is worth no more than transparency that lies in the other one.',
      'For the same reason the Schumann resonance is marked <b>traditional</b> rather than research-backed: the physical phenomenon itself is real and measured, but the link between it and any effect on body or mind is interpretation.',
      'Resona is a tool for relaxation and listening. It is not a medical device, does not diagnose or treat, and is not a substitute for professional advice. If you have epilepsy, a sensitivity to rhythmic stimulation or a neurological condition, consult a doctor before using the brainwave layer.',
    ],
  },
  {
    title: 'How it is built',
    paragraphs: [
      'A web app (PWA) that runs entirely in the browser. React and TypeScript for the interface, Tone.js for the audio engine, Tailwind for the design. The visualiser and the opening screen are drawn on a Canvas at the screen’s own pixel density.',
      '<b>The player’s visualiser</b> is the opening figure again, except that the rings are no longer decorative: each one is tuned to its own interval and reads the spectrum at exactly that pitch. When the music plays a fifth, the <ltr>3/2</ltr> ring is the one that flares. Measured against probes placed deliberately off the scale, the scale interval read louder in 260 frames out of 260 — a real bias, not a spectrograph.',
      '<b>The "Black" theme</b> is not "darker" but a different ground: true black with no hue and no frost, so edges land on the pixel instead of inside a blur, and the colours are raised because black offers no ambient light to lift them. The rings are drawn there additively, so overlapping glows sum into light rather than muddying each other.',
      'The ambience textures — rain, ocean, wind, noise — are synthesised rather than audio files, so there is no loop in them either.',
    ],
  },
]

export const ABOUT: Record<Lang, AboutSection[]> = { he: HE, en: EN }
