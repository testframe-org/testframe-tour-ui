// The frame screen's input editors (agents/specs/test-tour.md, "Inputs" and "Input cards"). An input is
// edited as JSON text, prefilled with the card's saved code, validated live and locally; the
// override applies to this tour only and is never written anywhere in the project.

import type { InputCard } from './protocol';

export interface InputDraft {
  step: number;
  varName: string;
  title: string;
  /** The saved code, formatted: what **Reset** goes back to and what "changed" is measured against. */
  saved: string;
  /** The text currently in the editor. */
  text: string;
}

export type JsonCheck = { ok: true; value: unknown } | { ok: false; error: string };

/** Parses `text` as JSON. `{{bindings}}` stay inside strings, as in any rawvalue card. */
export function parseJson(text: string): JsonCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Pretty-prints `text` when it is JSON; returns it unchanged otherwise (the editor then shows the error). */
export function formatJson(text: string): string {
  const check = parseJson(text);
  return check.ok ? JSON.stringify(check.value, null, 2) : text;
}

/** The drafts of a frame: one per input card, prefilled with its formatted saved value. */
export function toDrafts(inputs: readonly InputCard[]): InputDraft[] {
  return inputs.map((input) => {
    const saved = formatJson(input.value);
    return { step: input.step, varName: input.varName, title: input.title, saved, text: saved };
  });
}

export const isChanged = (draft: InputDraft): boolean => draft.text !== draft.saved;

export const resetDraft = (draft: InputDraft): InputDraft => ({ ...draft, text: draft.saved });

/** The first invalid input of the frame, or null when every one parses. Run is disabled while there is one. */
export function firstInvalid(drafts: readonly InputDraft[]): { varName: string; error: string } | null {
  for (const draft of drafts) {
    const check = parseJson(draft.text);
    if (!check.ok) return { varName: draft.varName, error: check.error };
  }
  return null;
}

/** The run request's `inputs`: every input's current text (the plugin re-validates it). */
export function runInputs(drafts: readonly InputDraft[]): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const draft of drafts) inputs[draft.varName] = draft.text;
  return inputs;
}
