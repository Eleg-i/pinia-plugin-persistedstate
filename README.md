# pinia-plugin-persistedstate —— Pinia Persisted State Plugin

[简体中文](readme/README-zh-cn.md) | English

## Description

A plugin that provides persistent state for Pinia, supporting advanced features such as custom storage, encryption, and partial state persistence.

## Getting Started

Install the dependency package

```bash
npm i @cailiao/pinia-plugin-persistedstate
```

## Basic Usage

### Import and Installation

```javascript
import { createPinia } from 'pinia'
import { createPersistedState } from '@cailiao/pinia-plugin-persistedstate'

const pinia = createPinia()

// Install the persistence plugin
pinia.use(
  createPersistedState({
    key: id => `__persisted__${id}`, // Custom storage key
    debug: import.meta.env.DEV // Enable debugging in development environment
  })
)

export default pinia
```

### Using in Store

```javascript
import { defineStore } from 'pinia'

// Define store reference for persistence
const store = {} as { state: StateTree }
const version = 1 // Version number, required

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
  
  // Business logic...
  
  return {
    authToken,
    userName,
    passwordHash,
    rememberPassword,
    autoLogin
    // Other methods...
  }
}, {
  persist: [
    {
      paths: ['authToken'], // Only persist authToken
      storage: sessionStorage, // Use sessionStorage
      store,
      version
    },
    {
      paths: ['userName', 'passwordHash', 'rememberPassword', 'autoLogin'],
      storage: localStorage, // Use localStorage
      store,
      version,
      crypto: ['passwordHash'], // Encrypt passwordHash field
      afterRestore: ({ store }) => {
        // Hook executed after restoration
        console.log('State has been restored')
      }
    }
  ]
})
```

## Configuration Options

### Global Configuration Options

When creating a plugin instance, you can provide global configuration options:

```javascript
createPersistedState({
  key: id => `__persisted__${id}`, // Global key generator
  storage: localStorage, // Default storage method
  debug: false, // Whether to enable debug mode
  serializer: { // Custom serializer
    serialize: JSON.stringify,
    deserialize: JSON.parse
  },
  beforeRestore: () => console.log('Before restore'), // Before restore hook
  afterRestore: () => console.log('After restore') // After restore hook
})
```

### Store Persistence Options

Each Store can be configured with multiple persistence schemes:

```javascript
persist: [
  {
    key: 'custom-key', // Storage key, takes precedence over global configuration
    storage: localStorage, // Storage method
    paths: ['field1', 'field2'], // Paths of fields to persist
    serializer: { // Custom serializer
      serialize: JSON.stringify,
      deserialize: JSON.parse
    },
    beforeRestore: () => {}, // Before restore hook
    afterRestore: () => {}, // After restore hook
    debug: false, // Whether to enable debugging
    store: { state: StateTree }, // State reference
    version: 1, // Version number (required)
    crypto: true || ['field1'] // Whether to encrypt all or specific fields
  }
]
```

## API Reference

### createPersistedState

```javascript
function createPersistedState(factoryOptions?: PersistedStateFactoryOptions): PiniaPlugin
```

Creates a Pinia persisted state plugin.

#### Parameters

- `factoryOptions`: Global persistence options

#### Return Value

- Pinia plugin function

### Plugin Extended Store Methods

#### $persist

```javascript
store.$persist(): void
```

Manually triggers state persistence.

#### $hydrate

```javascript
store.$hydrate(options?: { runHooks?: boolean }): void
```

Manually restores state from storage.

#### Parameters

- `options`:
  - `runHooks`: Whether to execute hook functions, defaults to true

## Type Definitions

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

## Notes

1. **Version is Required**: Each persistence configuration must set the `version` property, which is important for version management and clearing expired data.

2. **Store Reference**: When using the setup function to define a Store, you must provide a `store` object outside the setup function and set its `state` property within the setup function so that the plugin can correctly access and persist the state.

3. **Encryption**: For sensitive information, it is recommended to use the `crypto` option for encryption.

4. **Storage Selection**: Choose the appropriate storage method (localStorage or sessionStorage) based on the importance and lifecycle of the data.

5. **Performance Considerations**: For frequently changing states, it is recommended to use persistence cautiously or use a separate `key` for independent storage to avoid excessive storage operations.

## Support

Enjoying this project? Show your support by giving it a star! ⭐

Your stars help the project gain visibility and encourage further development.
