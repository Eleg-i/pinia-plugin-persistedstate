# pinia-plugin-persistedstate —— Pinia 状态持久化插件

简体中文 | [English](../README.md)

## 描述

为 Pinia 提供持久化状态的插件，支持自定义存储、加密、部分状态持久化等高级功能。

## 开始使用

安装依赖包

```bash
npm i @cailiao/pinia-plugin-persistedstate
```

## 基本用法

### 导入与安装

```javascript
import { createPinia } from 'pinia'
import { createPersistedState } from '@cailiao/pinia-plugin-persistedstate'

const pinia = createPinia()

// 安装持久化插件
pinia.use(
  createPersistedState({
    key: id => `__persisted__${id}`, // 自定义存储键名
    debug: import.meta.env.DEV // 开发环境下启用调试
  })
)

export default pinia
```

### 在 Store 中使用

```javascript
import { defineStore } from 'pinia'

// 定义 store 引用，用于持久化
const store = {} as { state: StateTree }
const version = 1 // 版本号，必须设置

export const useUserStore = defineStore('user', () => {
  const authToken = ref<string | null>(null)
  const userName = ref('')
  const passwordHash = ref('')
  const rememberPassword = ref(true)
  const autoLogin = ref(true)  

  store.state = Object.freeze({
    authToken,
    userName,
    passwordHash,
    rememberPassword,
    autoLogin
  })
  
  // 业务逻辑...
  
  return {
    authToken,
    userName,
    passwordHash,
    rememberPassword,
    autoLogin
    // 其他方法...
  }
}, {
  persist: [
    {
      paths: ['authToken'], // 只持久化 authToken
      storage: sessionStorage, // 使用 sessionStorage
      store,
      version
    },
    {
      paths: ['userName', 'passwordHash', 'rememberPassword', 'autoLogin'],
      storage: localStorage, // 使用 localStorage
      store,
      version,
      crypto: ['passwordHash'], // 加密 passwordHash 字段
      afterRestore: ({ store }) => {
        // 恢复后执行的钩子
        console.log('状态已恢复')
      }
    }
  ]
})
```

## 配置选项

### 全局配置选项

当创建插件实例时，可以提供全局配置选项：

```javascript
createPersistedState({
  key: id => `__persisted__${id}`, // 全局键名生成器
  storage: localStorage, // 默认存储方式
  debug: false, // 是否启用调试模式
  serializer: { // 自定义序列化器
    serialize: JSON.stringify,
    deserialize: JSON.parse
  },
  beforeRestore: () => console.log('恢复前'), // 恢复前钩子
  afterRestore: () => console.log('恢复后') // 恢复后钩子
})
```

### Store 持久化选项

每个 Store 可以配置多个持久化方案：

```javascript
persist: [
  {
    key: 'custom-key', // 存储键名，优先级高于全局配置
    storage: localStorage, // 存储方式
    paths: ['field1', 'field2'], // 持久化的字段路径
    serializer: { // 自定义序列化器
      serialize: JSON.stringify,
      deserialize: JSON.parse
    },
    beforeRestore: () => {}, // 恢复前钩子
    afterRestore: () => {}, // 恢复后钩子
    debug: false, // 是否启用调试
    store: { state: StateTree }, // 状态引用
    version: 1, // 版本号（必须）
    crypto: true || ['field1'] // 是否加密全部或指定字段
  }
]
```

## API 参考

### createPersistedState

```javascript
function createPersistedState(factoryOptions?: PersistedStateFactoryOptions): PiniaPlugin
```

创建 Pinia 持久化状态插件。

#### 参数

- `factoryOptions`：全局持久化选项

#### 返回值

- Pinia 插件函数

### 插件扩展的 Store 方法

#### $persist

```javascript
store.$persist(): void
```

手动触发状态持久化。

#### $hydrate

```javascript
store.$hydrate(options?: { runHooks?: boolean }): void
```

手动从存储中恢复状态。

#### 参数

- `options`：
  - `runHooks`：是否执行钩子函数，默认为 true

## 类型定义

### PersistedStateOptions

```typescript
interface PersistedStateOptions {
  key?: string | ((id: string) => string)
  storage?: StorageLike
  paths?: Array<string>
  serializer?: Serializer
  beforeRestore?: (context: PiniaPluginContext) => void
  afterRestore?: (context: PiniaPluginContext) => void
  debug?: boolean
  store: { state: StateTree }
  version: number
  crypto?: boolean | string[]
}
```

### PersistedStateFactoryOptions

```typescript
interface PersistedStateFactoryOptions {
  key?: (storeKey: string) => string
  storage?: StorageLike
  serializer?: Serializer
  afterRestore?: (context: PiniaPluginContext) => void
  beforeRestore?: (context: PiniaPluginContext) => void
  debug?: boolean
}
```

## 注意事项

1. **版本号必需**：每个持久化配置必须设置 `version` 属性，这对于版本管理和清除过期数据非常重要。

2. **store 引用**：在使用 setup 函数定义 Store 时，必须在 setup 函数外部提供 `store` 对象并在 setup 函数中设置其 `state` 属性，以便插件能够正确访问和持久化状态。

3. **加密**：对于敏感信息，建议使用 `crypto` 选项进行加密。

4. **存储选择**：根据数据的重要性和生命周期，选择合适的存储方式（localStorage 或 sessionStorage）。

5. **性能考虑**：对于高频变化的状态，建议谨慎使用持久化，或者单独使用 `key` 去独立存储，以避免过度的存储操作。

## 支持

喜欢这个项目吗？请给它一个 star 以示支持！⭐

您的 star 有助于项目获得更多关注，并鼓励进一步的开发。
