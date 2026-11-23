// The start screen's decisions (docs/test-tour.md, screen 1) and the frame screen's mongo-write
// warning (plan Phase 5, item 4). Pure functions: the screens render them, the tests pin them.

import type { EnvironmentSummary, FrameSummary, StreamCard } from './protocol';

/** A source ref the selected frames need and the chosen environment does not configure. */
export interface MissingSource {
  ref: string;
  /** The selected frames that need it, in the start screen's order. */
  frames: string[];
}

/**
 * Every source ref the `selected` frames use that is not configured for the environment: not
 * declared in `sources.yaml`, or with no resolved `base-url`. Start stays disabled while the list
 * is not empty.
 */
export function missingSources(
  frames: readonly FrameSummary[],
  selected: readonly string[],
  configured: readonly string[]
): MissingSource[] {
  const configuredSet = new Set(configured);
  const missing = new Map<string, string[]>();
  for (const name of selected) {
    const frame = frames.find((f) => f.name === name);
    if (!frame) continue;
    for (const ref of frame.sources) {
      if (configuredSet.has(ref)) continue;
      const list = missing.get(ref);
      if (list) list.push(name);
      else missing.set(ref, [name]);
    }
  }
  return [...missing.entries()].map(([ref, list]) => ({ ref, frames: list }));
}

/** The source refs configured for `environment` (empty when it is not in the list). */
export function configuredSources(
  environments: readonly EnvironmentSummary[],
  environment: string | null
): string[] {
  if (!environment) return [];
  return environments.find((e) => e.name === environment)?.sources ?? [];
}

/** Start is enabled when an environment is chosen, at least one frame is checked and none is missing. */
export function canStart(environment: string | null, selected: readonly string[], missing: readonly MissingSource[]): boolean {
  return Boolean(environment) && selected.length > 0 && missing.length === 0;
}

/** The frames the start screen lists: every frame, sorted by name, all checked. */
export const sortedFrameNames = (frames: readonly FrameSummary[]): string[] =>
  [...frames].map((f) => f.name).sort((a, b) => a.localeCompare(b));

/** The mongo subtypes that write to the chosen environment. */
export const MONGO_WRITE_SUBTYPES: readonly string[] = [
  'deleteOne',
  'deleteMany',
  'updateOne',
  'updateMany',
  'insertOne',
  'insertMany'
];

const isMongoWrite = (card: StreamCard): boolean =>
  card.source?.startsWith('mongo/') === true && card.subtype !== null && MONGO_WRITE_SUBTYPES.includes(card.subtype);

/** The cards of a frame that write to mongo, in run order. */
export function mongoWriteCards(cards: readonly StreamCard[]): StreamCard[] {
  return cards.filter(isMongoWrite);
}

/** The `mongo/*` refs a frame uses, from its summary: the warning shown before the first run. */
export function mongoSourceRefs(frame: FrameSummary | undefined): string[] {
  return (frame?.sources ?? []).filter((ref) => ref.startsWith('mongo/'));
}
