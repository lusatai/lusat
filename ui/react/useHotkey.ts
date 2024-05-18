import { type DependencyList, useCallback, useEffect } from 'react'
import { getDevicePlatform, parseChords } from '~/shared'

type Handler = (e?: KeyboardEvent) => void

type HotkeyAction = Handler | { call: Handler }

type Options = {
  /** Whether to enable within inputs. Defaults to `false`. */
  enableOnInputs?: boolean
}

type OptionsOrDependencyList = DependencyList | Options

export function useHotkey(
  /**
   * The hotkey(s) to listen for. This can be a single key, a combination of
   * keys separated by `+` to be triggered simultaneously, or even chords
   * separated by `then` to be triggered in sequence.
   * ```ts
   * 'a', 'cmd+k', 'alt+shift+c', 'g then i'
   * ```
   */
  hotkey: string,
  /**
   * The action to perform when the hotkey is pressed. Can be a nullary `Action`
   * or any nullary function or `KeyboardEvent` handler.
   */
  action: HotkeyAction,
  /**
   * Optional config.
   *
   * Can also be a dependency list.
   */
  options?: OptionsOrDependencyList,
  /**
   * Optional dependency list.
   *
   * Can also be optional config.
   */
  deps?: OptionsOrDependencyList,
) {
  const chords = parseChords(hotkey)

  const _options = (!Array.isArray(options) ? options : !Array.isArray(deps) ? deps : {}) ?? {}
  const _deps: DependencyList = Array.isArray(options) ? options : Array.isArray(deps) ? deps : []
  const callback: Handler = typeof action === 'object' ? action.call : action

  const memoisedCB = useCallback(callback, _deps)

  useEffect(() => {
    const platform = getDevicePlatform()

    // TODO: Support multiple chords.
    const chord = chords[0] ?? []
    const primary = chord.find(key => !['cmd', 'ctrl', 'alt', 'shift'].includes(key))

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !_options.enableOnInputs &&
        ['input', 'select', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())
      ) {
        return
      }

      if (
        (chord.includes('shift') ? e.shiftKey : true) &&
        (chord.includes('cmd') ? (platform === 'mac' ? e.metaKey : e.ctrlKey) : true) &&
        (chord.includes('alt') ? e.altKey : true) &&
        (chord.includes('ctrl') ? e.ctrlKey : true) &&
        primary &&
        e.key.toLowerCase() === primary
      ) {
        e.preventDefault()
        e.stopPropagation()
        memoisedCB(e)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: false })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [_options.enableOnInputs, memoisedCB, chords])
}
