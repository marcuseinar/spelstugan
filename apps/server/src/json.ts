/**
 * What can cross the wire.
 *
 * The plugin contract already requires that everything crossing it be plain
 * serializable data — never shared objects — but it types that data as
 * `unknown`, since a game's state is its own business. This is the same
 * promise, said in a way a type checker can act on.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * Takes a value the plugin contract has already promised is serializable.
 *
 * The single place that promise is converted into a type. If a game ever
 * returns something unserializable, it fails at the point of sending, which is
 * where a wire format should fail.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
