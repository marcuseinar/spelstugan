/**
 * Chat, per channel.
 *
 * Two kinds of line share one timeline: what people said, and what the game
 * did. Keeping them together is the whole product thesis — the conversation
 * and the play are one thread, not a game with a chat box bolted beside it
 * (decision 001).
 *
 * Nothing persists. A real implementation puts this behind the server; the
 * shape is kept simple so that swap is uninteresting.
 */

export type ChatLineKind = 'said' | 'played' | 'joined';

export interface ChatLine {
  readonly id: number;
  readonly kind: ChatLineKind;
  /** Who spoke, or who the event is about. Absent for channel-level notes. */
  readonly author?: string;
  readonly text: string;
}

export interface NewChatLine {
  readonly kind: ChatLineKind;
  readonly author?: string;
  readonly text: string;
}

/**
 * Chat logs keyed by channel.
 *
 * Ids are assigned here rather than by callers so that every line has a
 * stable identity for rendering, and so two channels cannot collide.
 */
export class ChatLog {
  private readonly byChannel = new Map<string, ChatLine[]>();
  private nextId = 1;

  /** Appends a line and returns it, with its assigned id. */
  append(channelId: string, line: NewChatLine): ChatLine {
    const stored: ChatLine = { ...line, id: this.nextId };
    this.nextId += 1;

    const existing = this.byChannel.get(channelId);
    if (existing === undefined) {
      this.byChannel.set(channelId, [stored]);
    } else {
      existing.push(stored);
    }
    return stored;
  }

  /** Every line in a channel, oldest first. Empty for a channel never used. */
  linesIn(channelId: string): readonly ChatLine[] {
    return this.byChannel.get(channelId) ?? [];
  }

  /** How many lines a channel holds — used for the unread-ish hints. */
  countIn(channelId: string): number {
    return this.linesIn(channelId).length;
  }
}

/** A trimmed message, or null if there was nothing but whitespace. */
export function messageToSend(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Turns a game event into a line for the channel, or null to say nothing.
 *
 * The reducer emits more events than are worth narrating; a chat that reports
 * every internal step is noise, so only the beats a player would mention out
 * loud make it through.
 */
export function describeGameEvent(event: {
  type: string;
  [detail: string]: unknown;
}): NewChatLine | null {
  const who = typeof event.playerId === 'string' ? event.playerId : '';

  switch (event.type) {
    case 'rolled':
      return { kind: 'played', author: who, text: `rolled ${event.roll}` };
    case 'captured':
      return {
        kind: 'played',
        author: String(event.byPlayerId ?? ''),
        text: `sent ${who} back to base`,
      };
    case 'token-home':
      return { kind: 'played', author: who, text: 'got a token home' };
    case 'extra-turn':
      return { kind: 'played', author: who, text: 'goes again' };
    case 'no-legal-move':
      return { kind: 'played', author: who, text: 'had no legal move' };
    case 'turn-forfeited':
      return { kind: 'played', author: who, text: 'rolled three sixes and lost the turn' };
    case 'game-won':
      return { kind: 'played', author: who, text: 'won the game' };
    default:
      return null;
  }
}
