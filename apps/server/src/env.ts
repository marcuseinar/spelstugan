/**
 * What the platform hands the Worker and its Durable Objects.
 *
 * In its own module because both the Worker and the table need it, and a type
 * they share should not make one import the other.
 */

import type { GameTable } from './table.js';

export interface Env {
  readonly GAME_TABLE: DurableObjectNamespace<GameTable>;
  /**
   * Which commit is running, set at deploy time.
   *
   * A deploy does not become live everywhere at once, and a Durable Object
   * lags the Worker in front of it: a table can still be running the version
   * the Worker just replaced. Both are asked before anything is tested.
   */
  readonly BUILD?: string;
}
