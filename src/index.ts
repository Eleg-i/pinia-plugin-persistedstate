import Locker from '@cailiao/locks'
import { merge } from 'es-toolkit'
import type { PiniaPlugin, PiniaPluginContext, StateTree, Store } from 'pinia'
import { watch, isRef } from 'vue'
import type { Ref } from 'vue'
import { encrypt, decrypt } from './modules/crypto'
import { normalizeOptions } from './modules/normalize'
import { pick } from './modules/pick'
import type {
  PersistedStateFactoryOptions,
  PersistedStateOptions,
  Serializer,
  StorageLike
} from './types'
import { forEach } from '@/utils/storage'

interface Persistence {
  storage?: StorageLike
  serializer: Serializer
  key: string
  realKey: string
  paths: string[] | null
  debug: boolean
  beforeRestore?: (c: PiniaPluginContext) => void
  afterRestore?: (c: PiniaPluginContext) => void
  store?: { state: StateTree }
  crypto?: boolean | string[]
  immediate?: boolean
  version: number
}

/**
 * 生成持久化解析器
 * @param factoryOptions 全局持久化选项
 * @param store          存储
 * @returns 持久化
 */
function parsePersistence(factoryOptions: PersistedStateFactoryOptions, store: Store) {
  /**
   * 返回一个持久化选项解析器
   * @param opt 持久化选项
   * @returns 解析后的持久化选项
   */
  return (opt: PersistedStateOptions): Persistence => {
    try {
      const {
        storage = localStorage,
        beforeRestore = void 0,
        afterRestore = void 0,
        serializer = {
          serialize: JSON.stringify,
          deserialize: JSON.parse
        },
        key = store.$id,
        paths = null,
        debug = false,
        store: _store = void 0,
        version,
        crypto = void 0
      } = opt

      return {
        afterRestore,
        beforeRestore,
        crypto,
        debug,
        /**
         * 获取 key
         * @param k key
         * @returns key
         */
        key: (factoryOptions.key ?? (k => k))(typeof key === 'string' ? key : key(store.$id)),
        paths,
        /**
         * 获取真实 key
         * @returns key
         */
        get realKey() {
          if (version === void 0) throw new Error('[pinia-plugin-persistedstate]：未设置版本！')

          return `${this.key}_${this.version}`
        },
        serializer,
        storage,
        store: _store,
        version
      }
    } catch (e) {
      console.error('[pinia-plugin-persistedstate]：解析参数异常', e)

      throw e
    }
  }
}

/**
 * 还原合并存储
 * @param store            存储
 * @param root0            选项
 * @param root0.storage    存储
 * @param root0.serializer 序列化器
 * @param root0.realKey    键
 * @param root0.store      存储
 * @param root0.crypto     加密
 */
async function hydrateStore(
  store: Store,
  { storage, serializer, realKey, store: _store, crypto }: Persistence
) {
  let fromStorage: string | null | undefined, presistState
  const state = _store?.state
  const innerState = state ?? (store.$state as StateTree)
  const isAllCrypto = crypto && !Array.isArray(crypto)
  const cryptoPaths = Array.isArray(crypto) ? crypto : null

  try {
    fromStorage = storage?.getItem(realKey)
  } catch (e) {
    console.error('[pinia-plugin-persistedstate]：取出储存异常', e)

    return
  }

  try {
    if (isAllCrypto && fromStorage) fromStorage = await decrypt(fromStorage)
  } catch (e) {
    console.error('[pinia-plugin-persistedstate]：解密异常', e)

    return
  }

  try {
    if (fromStorage) presistState = serializer.deserialize(fromStorage)
  } catch (e) {
    console.error('[pinia-plugin-persistedstate]：反序列化异常', e)

    return
  }

  // 解密任务
  const tasks = []

  for (const _key in presistState) {
    const innerKey = _key as keyof typeof innerState
    const value = innerState[innerKey]
    const { promise: waitDecrypt, resolve } = Promise.withResolvers<unknown>()
    const presistValue = presistState[innerKey]

    if (isRef(value)) (value as Ref).value = presistValue
    else if (innerState.hasOwnProperty(innerKey)) innerState[innerKey] = presistValue

    // 如果是加密字段，需要解密后赋值
    if (cryptoPaths && cryptoPaths.includes(innerKey.toString()))
      tasks.push(
        (async () => {
          let decryptValue: unknown

          if (isRef(value)) (value as Ref).value = waitDecrypt
          else if (innerState.hasOwnProperty(innerKey)) innerState[innerKey] = waitDecrypt

          try {
            decryptValue = await decrypt(presistState[innerKey])
          } catch (e) {
            console.error(`[pinia-plugin-persistedstate]：${innerKey.toString()} 解密异常`, e)

            return
          }

          try {
            decryptValue = serializer.deserialize(decryptValue as string)
          } catch (e) {
            console.error(`[pinia-plugin-persistedstate]：${innerKey.toString()} 反序列化异常`, e)

            return
          }

          if (isRef(value)) (value as Ref).value = decryptValue
          else if (innerState.hasOwnProperty(innerKey)) innerState[innerKey] = decryptValue

          resolve(decryptValue)
        })()
      )
  }

  // 等待所有解密任务完成
  await Promise.all(tasks)
}

/**
 * 持久化状态
 * @param state          状态
 * @param opt            选项
 * @param opt.storage    存储
 * @param opt.serializer 序列化器
 * @param opt.paths      路径
 * @param opt.immediate  是否立即储存
 * @param opt.realKey    真实键
 * @param opt.crypto     是否加密
 * @param watchNewVal    监听的参数
 */
async function persistState(
  state: StateTree,
  { storage, serializer, paths, immediate, realKey, crypto }: Persistence,
  watchNewVal?: Record<string, unknown>
) {
  let value: string,
      serialized: string,
      toStore: StateTree | null = null,
      lock: Lock | null = null

  if (!storage) {
    console.warn('[pinia-plugin-persistedstate]：未设置存储！')

    return
  }

  // 储存的有值则跳过初始化时的立即储存
  if (immediate && await storage.getItem(realKey)) return

  const isAllCrypto = crypto && !Array.isArray(crypto)

  /**
   * 保存数据
   */
  const setData = async () => {
    if (watchNewVal && !isAllCrypto) {
      let fromStorage, deserialized

      try {
        fromStorage = await storage.getItem(realKey)
      } catch (e) {
        console.error('[pinia-plugin-persistedstate]：取出储存异常', e)

        throw e
      }

      try {
        if (fromStorage) deserialized = serializer.deserialize(fromStorage)
      } catch (e) {
        console.error('[pinia-plugin-persistedstate]：反序列化异常', e)

        throw e
      }

      toStore = merge(deserialized ?? {}, watchNewVal)
    } else toStore = Array.isArray(paths) ? pick(state, paths) : state

    const cryptoPaths = Array.isArray(crypto) ? crypto : null

    if (cryptoPaths)
      try {
        for (const key in watchNewVal ?? toStore)
          if (cryptoPaths.includes(key))
            toStore[key] = await encrypt(serializer.serialize(toStore[key]))
      } catch (e) {
        console.error('[pinia-plugin-persistedstate]：加密异常', e)

        throw e
      }

    try {
      serialized = serializer!.serialize(toStore as StateTree)
    } catch (e) {
      console.error('[pinia-plugin-persistedstate]：序列化异常', e)

      throw e
    }

    try {
      value = isAllCrypto ? await encrypt(serialized) : serialized
    } catch (e) {
      console.error('[pinia-plugin-persistedstate]：加密异常', e)

      throw e
    }

    try {
      await storage!.setItem(realKey, value)
    } catch (e) {
      console.error('[pinia-plugin-persistedstate]：储存异常', e)
    }
  }

  // 加锁建立待写入队列，确保操作顺序，尽量避免高频操作被持久化的数据
  /**@todo 加入内存缓存， */
  try {
    lock = await Locker.request('persistState')

    await setData()
  } finally {
    if (lock) Locker.release(lock)
  }
}

/**
 * 清除过期的持久化状态
 * @param root0         选项
 * @param root0.storage 存储
 * @param root0.key     键
 * @param root0.debug   调试
 * @param root0.version 版本
 */
function clearOldPersistedState({ storage, key, debug, version }: Persistence) {
  if (!storage) {
    console.error('[pinia-plugin-persistedstate]', 'storage is not set')

    return
  }

  try {
    forEach(storage, storagekey => {
      if (storagekey.startsWith(key.replace(/_\d+$/, '')) && !storagekey.endsWith(`_${version}`))
        storage.removeItem(storagekey)
    })
  } catch (e) {
    if (debug) console.error('[pinia-plugin-persistedstate]', e)
  }
}

/**
 * 创建持久化状态
 * @param factoryOptions global persistence options
 * @returns pinia plugin
 */
export function createPersistedState(
  factoryOptions: PersistedStateFactoryOptions = {}
): PiniaPlugin {
  /**
   * 持久化状态插件
   * @param context 上下文
   */
  return (context: PiniaPluginContext) => {
    // const { auto = false } = factoryOptions
    const {
      options: { persist },
      store,
      pinia
    } = context

    if (!persist) return

    if (!(store.$id in pinia.state.value)) {
      // @ts-expect-error `_s is a stripped @internal`
      const originalStore = pinia._s.get(store.$id.replace('__hot:', ''))

      if (originalStore) queueMicrotask(() => originalStore.$persist())

      return
    }

    const persistences = (
      Array.isArray(persist)
        ? persist.map(p => normalizeOptions(p, factoryOptions))
        : [normalizeOptions(persist, factoryOptions)]
    )
      .map(parsePersistence(factoryOptions, store))
      .filter(Boolean) as Persistence[]

    /**
     * 执行持久化
     */
    store.$persist = () => {
      persistences.forEach(persistence => {
        persistState(store.$state, persistence)
      })
    }

    /**
     * 恢复持久化
     * @param opt          选项
     * @param opt.runHooks 是否执行钩子
     */
    store.$hydrate = ({ runHooks = true } = {}) => {
      persistences.forEach(async persistence => {
        const { beforeRestore, afterRestore } = persistence

        if (runHooks) await beforeRestore?.(context)

        await hydrateStore(store, persistence)

        if (runHooks) await afterRestore?.(context)
      })
    }

    persistences.forEach(async persistence => {
      const { beforeRestore, afterRestore, paths, store: _store } = persistence
      const state = _store?.state ?? store.$state

      const innerPaths = paths ?? Object.keys(store.$state)

      persistState(state, { ...persistence, immediate: true })
      clearOldPersistedState(persistence)

      beforeRestore?.(context)

      await hydrateStore(store, persistence)

      innerPaths.forEach(path => {
        watch(
          () => {
            const value = pick(state, [path])

            if (isRef(value)) return value.value
            else return value
          },
          newVal => persistState(state, persistence, { [path]: newVal })
        )
      })

      afterRestore?.(context)
    })
  }
}
