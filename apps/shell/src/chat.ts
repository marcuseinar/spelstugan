/**
 * A table's conversation, as the shell draws it.
 *
 * Two kinds of line share one timeline: what people said, and what the table
 * did. Keeping them together is the whole product thesis — the conversation
 * and the play are one thread, not a game with a chat box bolted beside it
 * (decision 001).
 *
 * The lines themselves come from the server, beside the move log (decision
 * 024). What lives here is the shape they are drawn in, and the one rule about
 * sending: nothing is sent that is only whitespace.
 */

export type ChatLineKind = 'said' | 'played' | 'joined';

export interface ChatLine {
  readonly id: number;
  readonly kind: ChatLineKind;
  /** Who spoke, or who the event is about. Absent for channel-level notes. */
  readonly author?: string;
  readonly text: string;
}

/** A trimmed message, or null if there was nothing but whitespace. */
export function messageToSend(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}
