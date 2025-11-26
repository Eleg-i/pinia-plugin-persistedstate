import type { PiniaPluginContext, StateTree } from 'pinia'

type Prettify<T> = { [K in keyof T]: T[K] }

export type StorageLike = typeof localStorage | typeof sessionStorage

export interface Serializer {
  /**
   * 在存储之前将状态序列化为字符串
   * @default JSON.stringify
   */
  serialize: (value: StateTree) => string

  /**
   * 在填充状态之前将字符串反序列化为状态
   * @default JSON.parse
   */
  deserialize: (value: string) => StateTree
}

export interface PersistedStateOptions {
  /**
   * 使用的存储键名
   * @default $store.id
   */
  key?: string | ((id: string) => string)

  /**
   * 持久化状态的存储位置
   * @default localStorage
   */
  storage?: StorageLike

  /**
   * 点符号路径，用于部分保存状态。如果未定义，则保存所有状态
   * @default undefined
   */
  paths?: Array<string>

  /**
   * 自定义序列化器，用于序列化/反序列化状态
   */
  serializer?: Serializer

  /**
   * 在从存储中恢复状态之前调用的钩子
   * @default undefined
   */
  beforeRestore?: (context: PiniaPluginContext) => void

  /**
   * 在从存储中恢复状态之后调用的钩子
   * @default undefined
   */
  afterRestore?: (context: PiniaPluginContext) => void

  /**
   * 启用时在控制台打印错误
   * @default false
   */
  debug?: boolean

  /**
   * 当找不到持久化状态时使用的初始状态
   * @default undefined
   */
  store: { state: StateTree }

  /**
   * 当前 store 版本
   * @default false
   */
  version: number

  /**
   * 启用时将状态加密/解密
   * @default undefined
   */
  crypto?: boolean | string[]
}

export type PersistedStateFactoryOptions = Prettify<
  Pick<
    PersistedStateOptions,
    'storage' | 'serializer' | 'afterRestore' | 'beforeRestore' | 'debug'
  > & {
    /**
     * 全局键生成器，允许在存储键前后添加前缀或后缀
     * @default storeKey => storeKey
     */
    key?: (storeKey: string) => string

    /**
     * 自动持久化所有存储，并允许单独退出
     * @default false
     */
    auto?: boolean
  }
>

declare module 'pinia' {
  export interface DefineStoreOptionsBase<S extends StateTree, Store> {
    persist: PersistedStateOptions | PersistedStateOptions[]
  }

  export interface PiniaCustomProperties {
    $hydrate: (opts?: { runHooks?: boolean }) => void

    $persist: () => void
  }
}
