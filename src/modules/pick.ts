import type { StateTree } from 'pinia'
import { isRef } from 'vue'

/**
 * 获取值
 * @param state 状态
 * @param path  路径
 * @returns 值
 */
function get(state: StateTree, path: Array<string>): unknown {
  const value = path.reduce((obj, p) => {
    return obj?.[p]
  }, state)
  const result = isRef(value) ? value.value : value

  return result
}

/**
 * 设置值
 * @param state 状态
 * @param path  路径
 * @param val   值
 * @returns 状态
 */
function set(state: StateTree, path: Array<string>, val: unknown): StateTree {
  path.slice(0, -1).reduce((obj, p) => {
    if (/^(__proto__)$/.test(p)) return {}
    else {
      obj[p] = obj[p] || {}

      return obj[p]
    }
  }, state)[path[path.length - 1]] = val

  return state
}

/**
 * 选择状态
 * @param baseState 状态
 * @param paths     路径
 * @returns 状态
 */
export function pick(baseState: StateTree, paths: string[]): StateTree {
  return paths.reduce<StateTree>((substate, path) => {
    const pathArray = path.split('.')

    return set(substate, pathArray, get(baseState, pathArray))
  }, {})
}
