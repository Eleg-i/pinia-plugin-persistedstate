import type { PersistedStateFactoryOptions, PersistedStateOptions } from '../types'

/**
 * 标准化选项
 * @param options        选项
 * @param factoryOptions 构造器选项
 * @returns 标准化选项
 */
export function normalizeOptions(
  options: PersistedStateOptions,
  factoryOptions: PersistedStateFactoryOptions
): PersistedStateOptions {
  return new Proxy(options as object, {
    get(target, key, receiver) {
      if (key === 'key') return Reflect.get(target, key, receiver)

      return Reflect.get(target, key, receiver) ?? Reflect.get(factoryOptions, key, receiver)
    }
  }) as PersistedStateOptions
}
