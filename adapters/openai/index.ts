import type { Actions } from '~/core/action'
import type { Workflow } from '~/core/workflow'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * This is the type of the `functions` parameter to the `openai` JS/TS
 * API for `createChatCompletion`.
 */
export type ChatCompletionFunctions = {
  /**
   * The name of the function to be called. Must be a-z, A-Z, 0-9, or
   * contain underscores and dashes, with a maximum length of 64.
   */
  name: string
  /** The description of what the function does. */
  description?: string
  /**
   * The parameters the functions accepts, described as a JSON Schema
   * object.
   */
  parameters?: { [key: string]: unknown }
}[]

/**
 * Adapter to convert Lusat `Actions` into an OpenAI
 * `ChatCompletionFunctions`.
 *
 * Example:
 *
 * ```ts
 * import { z } from 'zod'
 *
 * import { action } from 'lusat'
 *
 * const functions = gptFunctions({
 *   getCurrentWeather: action()
 *     .describe('Get the current weather')
 *     .input(
 *       z.object({
 *         location: z.string().describe('The city and state'),
 *       }),
 *     )
 *     .handle(handler),
 * })
 *
 * const completion = await openai.createChatCompletion({
 *   model: 'gpt-3.5-turbo-16k',
 *   messages,
 *   functions, // Automatically converted to the correct format.
 * })
 * ```
 *
 * You can then call the function in your app from GPT returned function
 * calls in the completion with `callFunction` or
 * `gptFunctionCallToWorkflow` from `lusat/adapters/openai`, using the
 * same `Actions` object and taking advantage of the parsing and
 * validation defined in your input schema.
 */
export function gptFunctions(
  actions: Actions,
): ChatCompletionFunctions {
  return Object.entries(actions).map(([name, action]) => ({
    name: action.name ?? name,
    description: action.description,
    parameters:
      action._args === 'unary'
        ? Object.fromEntries(
            Object.entries(zodToJsonSchema(action._inputParser)).filter(
              ([k]) => k !== '$schema',
            ),
          )
        : {
            type: 'object',
            properties: {},
            required: [],
          },
  }))
}

/**
 * This is the type of the function call return we get back from the
 * `openai` JS/TS API for `createChatCompletion`.
 */
export type ChatCompletionRequestMessageFunctionCall = {
  /** The name of the function to call. */
  name?: string
  /**
   * The arguments to call the function with, as generated by the model
   * in JSON format. Note that the model does not always generate valid
   * JSON, and may hallucinate parameters not defined by your function
   * schema. Validate the arguments in your code before calling your
   * function.
   */
  arguments?: string
}

/**
 * Adapter to convert a GPT function call into a Lusat `Workflow`.
 *
 * Example:
 *
 * ```ts
 * const workflow = gptFunctionCallToWorkflow(
 *   gptFunctionCall, // From OpenAI API.
 *   actions, // From a Lusat `App` or `Actions`.
 * )
 * ```
 *
 * Now we've converted the function call to a Lusat `Workflow`, and we
 * even get the input parsed and validated before we run it.
 *
 * ```ts
 * // Run the workflow with your Lusat `App`:
 * // NOTE: `App.run` not yet implemented as of 0.0.11
 * myApp.run(workflow)
 *
 * // or directly:
 * const { action, input } = workflow[0]
 * const result = actions[action].call(input)
 * ```
 */
export function gptFunctionCallToWorkflow<TActions extends Actions>(
  gptFunctionCall: ChatCompletionRequestMessageFunctionCall,
  actions: TActions,
): Workflow<TActions> {
  if (!gptFunctionCall.name) {
    throw new Error('Missing function name.')
  }
  const action = actions[gptFunctionCall.name]
  if (!action) {
    throw new Error(`Unknown function "${gptFunctionCall.name}".`)
  }

  let input
  if (action._args === 'unary') {
    input = action._inputParser.parse(
      JSON.parse(gptFunctionCall.arguments ?? '{}'),
    )
  }

  return [{ action: gptFunctionCall.name, input }]
}

/**
 * Adapter to run a GPT function call with Lusat `Actions`, either from
 * an `App` or directly.
 *
 * This way you get automatic parsing, detection, error-handling, and
 * input validation, and the action is ran after successful validation
 * and optional middlewares.
 *
 * Example:
 *
 * ```ts
 * const { result } = await callFunction(
 *   gptFunctionCall, // From OpenAI API.
 *   actions, // From a Lusat `App` or `Actions`.
 * )
 * ```
 *
 * Note that this direct call does not handle things like danger
 * handling and automatically request user authorization for actions
 * that require it. For that, use `gptFunctionCallToWorkflow` from
 * `lusat/adapters/openai` and run the workflow with your Lusat `App`.
 */
export async function callFunction<TActions extends Actions>(
  gptFunctionCall: ChatCompletionRequestMessageFunctionCall,
  actions: TActions,
) {
  if (!gptFunctionCall.name) {
    throw new Error('Missing function name.')
  }
  const action = actions[gptFunctionCall.name]
  if (!action) {
    throw new Error(`Unknown function "${gptFunctionCall.name}".`)
  }

  const result = await (action._args === 'unary'
    ? action.call(JSON.parse(gptFunctionCall.arguments ?? '{}'))
    : action.call())

  return {
    action: gptFunctionCall.name,
    result,
  }
}
