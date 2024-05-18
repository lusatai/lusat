import type { Actions } from '~/core/action'
import type { Workflow } from '~/core/workflow'

/** An example user prompt and workflow, used for testing and reasoning. */
export type Example<T extends Actions> = { prompt: string; workflow: Workflow<T> }

/** A set of examples, used for testing and reasoning. */
export type Examples<T extends Actions> = Record<string, Example<T>>

/**
 * Util to type-check a set of examples.
 * ```ts
 * examples({
 *   createTodo: {
 *     prompt: 'Remind me to sleep',
 *     workflow: [{ action: 'createTodo', input: 'Sleep' }],
 *   },
 * })
 * ```
 */
export function examples<T extends Actions>(def: Examples<T>) {
  return def
}
