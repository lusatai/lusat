import type { Completions } from 'openai/resources/chat'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Actions } from '~/core/action'
import type { Workflow } from '~/core/workflow'

/**
 * Adapter to convert Lusat `Actions` into a list of OpenAI `Function` objects.
 *
 * Example:
 * ```ts
 * import { z } from 'zod'
 * import { action } from 'lusat'
 *
 * const functions = gptFunctions({
 *   getCurrentWeather: action()
 *     .describe('Get the current weather')
 *     .input(
 *       z.object({ location: z.string().describe('The city and state') }),
 *     )
 *     .handle(handler),
 * })
 *
 * const completion = await openai.chat.completions.create({
 *   model: 'gpt-3.5-turbo-16k',
 *   messages,
 *   functions,
 * })
 * ```
 * You can then call the function in your app from GPT returned function calls
 * in the completion with `callFunction` or `gptFunctionCallToWorkflow` from
 * `lusat/adapters/openai`, using the same `Actions` object and taking advantage
 * of the parsing and validation defined in your input schema.
 */
export function gptFunctions(actions: Actions): Completions.ChatCompletionCreateParams.Function[] {
  return Object.entries(actions).map(([name, action]) => ({
    name: action.name ?? name,
    description: action.description,
    parameters:
      action.arity === 'unary'
        ? Object.fromEntries(
            Object.entries(zodToJsonSchema(action.inputParser)).filter(([k]) => k !== '$schema'),
          )
        : { type: 'object', properties: {}, required: [] },
  }))
}

/**
 * Adapter to convert a GPT function call into a Lusat `Workflow`.
 *
 * Example:
 * ```ts
 * const workflow = gptFunctionCallToWorkflow(gptFunctionCall, actions)
 * ```
 * Now we've converted the function call to a Lusat `Workflow`, and we even get
 * the input parsed and validated before we run it.
 * ```ts
 * // Run the workflow with your Lusat `App`:
 * run(myApp, workflow)
 *
 * // or directly:
 * const { action, input } = workflow[0]
 * const result = actions[action].call(input)
 * ```
 */
export function gptFunctionCallToWorkflow<TActions extends Actions>(
  gptFunctionCall: Completions.ChatCompletionMessage.FunctionCall,
  actions: TActions,
): Workflow<TActions> {
  if (!gptFunctionCall.name) {
    throw new Error('Missing function name.')
  }
  const action = actions[gptFunctionCall.name]
  if (!action) {
    throw new Error(`Unknown function "${gptFunctionCall.name}".`)
  }
  let input: unknown
  if (action.arity === 'unary') {
    input = action.inputParser.parse(JSON.parse(gptFunctionCall.arguments))
  }
  return [{ action: gptFunctionCall.name, input }]
}

/**
 * Adapter to run a GPT function call with Lusat `Actions`, either from an `App`
 * or directly.
 *
 * This way you get automatic parsing, detection, error-handling, and input
 * validation, and the action is ran after successful validation and optional
 * middlewares.
 *
 * Example:
 * ```ts
 * const { result } = await callFunction(
 *   gptFunctionCall, // From OpenAI API.
 *   actions, // From a Lusat `App` or `Actions`.
 * )
 * ```
 * Note that this direct call does not handle things like danger handling and
 * automatically request user authorization for actions that require it. For
 * that, use `gptFunctionCallToWorkflow` from `lusat/adapters/openai` and run
 * the workflow with your Lusat `App`.
 */
export async function callFunction<TActions extends Actions>(
  gptFunctionCall: Completions.ChatCompletionMessage.FunctionCall,
  actions: TActions,
) {
  if (!gptFunctionCall.name) {
    throw new Error('Missing function name.')
  }
  const action = actions[gptFunctionCall.name]
  if (!action) {
    throw new Error(`Unknown function "${gptFunctionCall.name}".`)
  }
  const result = await (action.arity === 'unary'
    ? action.call(JSON.parse(gptFunctionCall.arguments))
    : action.call())
  return { action: gptFunctionCall.name, result }
}
