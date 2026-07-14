import { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { MGLogo } from '../common/MGLogo';
import type { User } from '../../data/user';

/**
 * First-login guided tour for investors: a short cinematic intro, then a
 * spotlight walk over the real dashboard elements (anchored via data-tour
 * attributes on the actual UI), and a closing screen.
 *
 * Shown once per investor, tracked client-side (no API route — Vercel
 * function cap). Keyed by mondayInvestorId so the same person re-logging
 * on this device won't see it twice.
 */
const SEEN_PREFIX = 'mg_onboarding_seen_v1:';

/** Per-user key. Falls back to the local id for the demo account, which has
    no Monday investor behind it. */
function seenKey(user: User): string {
  return SEEN_PREFIX + (user.mondayInvestorId ?? user.id);
}

/**
 * Clears the "already seen" flag so the tour plays again on the next mount of
 * the dashboard. Settings uses this for its "replay the tour" row.
 */
export function replayOnboarding(user: User): void {
  try {
    localStorage.removeItem(seenKey(user));
  } catch { /* private mode — non-fatal */ }
}

interface TourStep {
  target: string; // matches [data-tour="..."] on a visible element
  title: string;
  desc: string;
}

/* Steps resolve against whatever is actually on screen: desktop finds the
   sidebar items, mobile finds the tab bar / floating buttons. A step whose
   target doesn't exist (e.g. analytics on mobile, feed for the demo user)
   is skipped automatically. */
const TOUR_STEPS: TourStep[] = [
  {
    target: 'stats',
    title: 'התיק שלך במספרים',
    desc: 'שווי התיק, מספר הנכסים והתשואה — תמיד כאן למעלה, מתעדכנים אוטומטית ממערכות הניהול שלנו.',
  },
  {
    target: 'properties',
    title: 'כרטיסי הנכסים',
    desc: 'כל נכס מקבל כרטיס משלו. לחיצה על כרטיס פותחת את כל הפרטים — התקדמות שיפוץ, הלוואות, מסמכים ותמונות מהשטח.',
  },
  {
    target: 'feed',
    title: 'עדכונים אחרונים',
    desc: 'ציר הזמן מרכז את מה שקרה לאחרונה בנכסים שלך. לחיצה על עדכון קופצת ישירות לנכס הרלוונטי.',
  },
  {
    target: 'nav-documents',
    title: 'המסמכים שלך',
    desc: 'חוזים, דוחות וכל מסמך שקשור להשקעות — מסודרים לפי נכס וזמינים להורדה בכל רגע.',
  },
  {
    target: 'nav-media',
    title: 'מדיה מהשטח',
    desc: 'תמונות וסרטונים עדכניים מהנכסים — רואים את ההתקדמות במו העיניים, בלי לטוס.',
  },
  {
    target: 'nav-renovations',
    title: 'מעקב שיפוצים',
    desc: 'סטטוס השיפוץ בכל נכס — שלבים, תשלומים והתקדמות, שקוף עד הפרט האחרון.',
  },
  {
    target: 'nav-utilities',
    title: 'Utilities',
    desc: 'חשבונות החשמל, המים והגז של הנכסים — מרוכזים במקום אחד.',
  },
  {
    target: 'nav-deal-room',
    title: 'חדר העסקאות',
    desc: 'כאן מחכות ההזדמנויות: עסקאות שפתוחות להשקעה כרגע, עם כל הנתונים. כשנפתחת עסקה חדשה — מגיעה התראה.',
  },
  {
    target: 'nav-analytics',
    title: 'אנליטיקות',
    desc: 'גרפים וניתוחים של התיק — תשואות, פיזור והתקדמות לאורך זמן.',
  },
  {
    target: 'nav-inquiries',
    title: 'פניות',
    desc: 'יש שאלה? פותחים כאן פנייה והצוות שלנו חוזר אליך. כל ההתכתבות נשמרת מסודרת.',
  },
  {
    target: 'bell',
    title: 'התראות',
    desc: 'הפעמון מעדכן על כל דבר חשוב — עסקה חדשה, עדכון בנכס או תשובה לפנייה.',
  },
  {
    target: 'nav-settings',
    title: 'הגדרות',
    desc: 'עדכון פרטים אישיים, העדפות מייל ומעבר בין מצב כהה לבהיר. וזהו — סיימנו!',
  },
];

/* Deterministic particle field (Date/random-free so renders are stable) */
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61 + 9) % 100,
  size: 2 + (i % 3),
  delay: (i * 0.9) % 7,
  dur: 8 + (i % 5) * 2.2,
}));

const HOLE_PAD = 10;

function findTarget(name: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  // pick the visible instance (sidebar on desktop, tab bar on mobile)
  return els.find(el => el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0) ?? null;
}

interface HoleBox { top: number; left: number; width: number; height: number; }

/** Padded spotlight box, clamped to the viewport so oversized targets
    (e.g. the property grid) still frame as a visible window. */
function measureHole(el: HTMLElement): HoleBox {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = Math.max(r.top - HOLE_PAD, 8);
  const left = Math.max(r.left - HOLE_PAD, 8);
  const right = Math.min(r.right + HOLE_PAD, vw - 8);
  const bottom = Math.min(r.bottom + HOLE_PAD, vh - 8);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

function Particles() {
  return (
    <>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ob-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </>
  );
}

type Phase = 'intro' | 'tour' | 'outro';

export function InvestorOnboarding() {
  const { currentUser } = useUser();

  const storageKey = currentUser ? seenKey(currentUser) : null;

  const [visible, setVisible] = useState(() => {
    if (!currentUser || currentUser.isAdmin || !storageKey) return false;
    try {
      return !localStorage.getItem(storageKey);
    } catch {
      return false; // storage unavailable → can't remember dismissal, don't nag every visit
    }
  });
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [stepIdx, setStepIdx] = useState(0);
  const [hole, setHole] = useState<HoleBox | null>(null);
  // indexes of steps that resolved to a real element when the tour started
  const [available, setAvailable] = useState<number[]>([]);

  const finish = () => {
    if (closing) return;
    try {
      if (storageKey) localStorage.setItem(storageKey, new Date().toISOString());
    } catch { /* private mode — non-fatal */ }
    setClosing(true);
  };

  // Unmount when the close animation ends. onAnimationEnd is the happy path,
  // but changing animation-name on an element that already ran its entrance
  // doesn't reliably re-fire it — so a timeout (slightly longer than the 280ms
  // fade) guarantees we tear down and release the body scroll lock.
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => setVisible(false), 340);
    return () => window.clearTimeout(t);
  }, [closing]);

  const applyStep = (i: number) => {
    const el = findTarget(TOUR_STEPS[i].target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // bring off-screen targets into view before measuring; oversized targets
    // align to their top so the tour "window" starts where the content does
    if (r.top < 70 || r.bottom > vh - 90) {
      el.scrollIntoView({ block: r.height > vh * 0.55 ? 'start' : 'center', behavior: 'auto' });
    }
    setHole(measureHole(el));
    setStepIdx(i);
  };

  const goStep = (from: number, dir: 1 | -1) => {
    let i = from;
    while (i >= 0 && i < TOUR_STEPS.length && !findTarget(TOUR_STEPS[i].target)) i += dir;
    if (i < 0) { setPhase('intro'); return; }
    if (i >= TOUR_STEPS.length) { setPhase('outro'); return; }
    applyStep(i);
  };

  const startTour = () => {
    setAvailable(
      TOUR_STEPS.map((s, i) => (findTarget(s.target) ? i : -1)).filter(i => i >= 0),
    );
    setPhase('tour');
    goStep(0, 1);
  };
  const nextStep = () => goStep(stepIdx + 1, 1);
  const prevStep = () => goStep(stepIdx - 1, -1);

  // Keyboard: Enter/ArrowLeft advance (RTL forward = left), ArrowRight back, Esc skips.
  useEffect(() => {
    if (!visible || closing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { finish(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowLeft') {
        if (phase === 'intro') startTour();
        else if (phase === 'tour') nextStep();
        else finish();
      } else if (e.key === 'ArrowRight' && phase === 'tour') {
        prevStep();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Keep the spotlight glued to its target through resize/scroll.
  useEffect(() => {
    if (!visible || phase !== 'tour') return;
    const remeasure = () => {
      const el = findTarget(TOUR_STEPS[stepIdx].target);
      if (el) setHole(measureHole(el));
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [visible, phase, stepIdx]);

  // Lock background scroll during intro/outro (tour needs the page in place anyway).
  useEffect(() => {
    if (!visible || phase === 'tour') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible, phase]);

  if (!visible || !currentUser) return null;

  const onAnimEnd = (e: React.AnimationEvent) => {
    if (closing && e.target === e.currentTarget) setVisible(false);
  };

  /* ── Intro / outro overlays ── */
  if (phase === 'intro' || phase === 'outro') {
    const isIntro = phase === 'intro';
    return (
      <div
        className={`ob-overlay${closing ? ' ob-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="סיור היכרות עם הפורטל"
        onAnimationEnd={onAnimEnd}
      >
        <div className="ob-orb ob-orb-1" />
        <div className="ob-orb ob-orb-2" />
        <Particles />

        <div className="ob-hero" key={phase}>
          {isIntro ? (
            <>
              <div className="ob-logo"><MGLogo size={50} /></div>
              <div className="ob-kicker">MILLER GROUP</div>
              <h1 className="ob-title">
                שלום, {currentUser.firstNameHe}
                <span className="ob-title-accent">ברוכים הבאים לפורטל שלך</span>
              </h1>
              <p className="ob-desc">
                נצא לסיור קצר של דקה — נעבור יחד על הדאשבורד, צעד אחר צעד,
                ונראה איפה נמצא כל מה שחשוב: ההשקעות, המסמכים וההזדמנויות הבאות.
              </p>
              <div className="ob-cta-row">
                <button className="mg-btn ob-cta" onClick={startTour}>יאללה, נתחיל</button>
                <button className="ob-later" onClick={finish}>דילוג — אסתדר לבד</button>
              </div>
            </>
          ) : (
            <>
              <svg className="ob-check" viewBox="0 0 52 52" width="86" height="86">
                <circle className="ob-check-circle" cx="26" cy="26" r="24"
                  fill="none" stroke="var(--gold)" strokeWidth="2" />
                <path className="ob-check-mark" d="M15 27l8 8 15-17"
                  fill="none" stroke="var(--gold-bright)" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h1 className="ob-title">
                זהו, הכול מוכן
                <span className="ob-title-accent">הפורטל שלך מחכה</span>
              </h1>
              <p className="ob-desc">
                מעכשיו הכול בהישג יד — ואם משהו לא ברור, אנחנו תמיד
                במרחק פנייה אחת. השקעה נעימה!
              </p>
              <div className="ob-cta-row">
                <button className="mg-btn ob-cta" onClick={finish}>כניסה לפורטל</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Spotlight tour ── */
  if (!hole) return null;

  const step = TOUR_STEPS[stepIdx];
  const pos = available.indexOf(stepIdx) + 1;
  const total = available.length;
  const isLastStep = pos === total;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Card: below the target when there's room, otherwise above; when the
  // spotlight fills the screen (oversized target), float over its bottom.
  const cardW = Math.min(340, vw - 32);
  const spaceBelow = vh - (hole.top + hole.height);
  const spaceAbove = hole.top;
  const placement = spaceBelow >= 230 ? 'below' : spaceAbove >= 230 ? 'above' : 'overlay';
  let cardLeft = hole.left + hole.width / 2 - cardW / 2;
  cardLeft = Math.max(16, Math.min(cardLeft, vw - 16 - cardW));
  const arrowX = Math.max(20, Math.min(hole.left + hole.width / 2 - cardLeft - 6, cardW - 32));

  const cardStyle: React.CSSProperties = {
    width: cardW,
    left: cardLeft,
    ...(placement === 'below' ? { top: hole.top + hole.height + 14 }
      : placement === 'above' ? { bottom: vh - hole.top + 14 }
      : { bottom: Math.max(vh - (hole.top + hole.height) + 20, 96) }),
  };

  return (
    <div
      className={`tour-layer${closing ? ' ob-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      onAnimationEnd={onAnimEnd}
      onClick={nextStep}
    >
      <div className="tour-hole" style={hole} />
      <div className="tour-halo" style={hole} />

      <div key={stepIdx} className="tour-card" style={cardStyle} onClick={e => e.stopPropagation()}>
        {placement !== 'overlay' && (
          <div className={`tour-arrow ${placement === 'below' ? 'up' : 'down'}`} style={{ left: arrowX }} />
        )}
        <div className="tour-progress-track">
          <div className="tour-progress-fill" style={{ width: `${(pos / total) * 100}%` }} />
        </div>
        <div className="tour-step-count num">{pos} / {total}</div>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-desc">{step.desc}</p>
        <div className="tour-actions">
          <button className="mg-btn tour-next" onClick={nextStep}>
            {isLastStep ? 'סיום' : 'הבא'}
          </button>
          {pos > 1 && (
            <button className="tour-back" aria-label="חזרה" onClick={prevStep}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
          <button className="tour-skip" onClick={finish}>דילוג</button>
        </div>
      </div>
    </div>
  );
}
