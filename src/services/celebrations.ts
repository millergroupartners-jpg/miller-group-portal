import type { MondayProperty } from './mondayApi';
import { readJson, writeJson } from './userStorage';

/**
 * One-time milestone detection for the dashboard confetti: compares the
 * investor's properties against the snapshot from their previous visit and
 * celebrates a renovation reaching 100% or a property becoming rented.
 *
 * First-ever call stores a baseline and celebrates nothing — history isn't
 * news. StrictMode-safe: the snapshot is updated before returning, so a
 * double-invoked effect gets [] on the second run (callers must therefore
 * only SET state on a non-empty result, never clear it).
 */
const PREFIX = 'mg_celebrated_v1:';

const RENTED_LABEL = 'מושכר';

type Snapshot = Record<string, { progress: number; status: string }>;

export interface CelebrationEvent {
  property: MondayProperty;
  kind: 'renovation-complete' | 'rented';
}

export function diffAndSnapshot(userKey: string, props: MondayProperty[]): CelebrationEvent[] {
  const key = PREFIX + userKey;
  const prev = readJson<Snapshot>(key);

  const next: Snapshot = {};
  for (const p of props) next[p.mondayId] = { progress: p.progress, status: p.status };
  writeJson(key, next);

  if (!prev) return []; // baseline visit

  const events: CelebrationEvent[] = [];
  for (const p of props) {
    const before = prev[p.mondayId];
    if (!before) continue; // property new to the portfolio — baseline silently
    if (before.status !== RENTED_LABEL && p.status === RENTED_LABEL) {
      events.push({ property: p, kind: 'rented' });
    } else if (before.progress < 100 && p.progress >= 100) {
      events.push({ property: p, kind: 'renovation-complete' });
    }
  }
  // One celebration per visit — tasteful, not a slot machine.
  return events.slice(0, 1);
}
