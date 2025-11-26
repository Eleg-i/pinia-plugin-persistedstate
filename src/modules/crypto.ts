const cryptpEnabled = self.crypto?.subtle

/**
 * 加密
 * @param serialized 待加密的字符串
 */
export const encrypt = async (serialized: string): Promise<string> => {
  if (!cryptpEnabled) {
    console.warn('[pinia-plugin-persistedstate]', '当前浏览器不支持web crypto api，请检查！')

    return serialized
  }

  // 使用web crypto api
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(serialized)
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encoded
  )
  const result = new Uint8Array(iv.length + ciphertext.byteLength)

  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), iv.length)
  checkSize(serialized)

  return btoa(String.fromCharCode(...result))
}

/**
 * 解密
 * @param encrypted 加密字符串
 */
export const decrypt = async (encrypted: string): Promise<string> => {
  if (!cryptpEnabled) {
    console.warn('[pinia-plugin-persistedstate]', '当前浏览器不支持web crypto api，请检查！')

    return encrypted
  }

  const key = await getCryptoKey()
  const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const iv = data.slice(0, 12)
  const ciphertext = data.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    ciphertext
  )

  checkSize(encrypted)

  return new TextDecoder().decode(decrypted)
}

/**
 * 检查数据大小
 * @param str 待检查的字符串
 */
const checkSize = (str: string) => {
  if (str.length > 1e5) console.warn('[pinia-plugin-persistedstate]', '加解密数据过大，请检查！')
}

// 内部使用的密码
const key = new Uint8Array([
  80, 114, 101, 115, 105, 115, 116, 83, 116, 111, 114, 101, 64, 99, 104, 101, 110, 121, 117
])
const salt = new Uint8Array([107, 101, 121, 101, 114])
let cryptoKey: CryptoKey | null = null

/**
 * 获取密钥实例
 */
async function getCryptoKey(): Promise<CryptoKey> {
  if (cryptoKey) return cryptoKey

  const baseKey = await crypto.subtle.importKey('raw', key, 'PBKDF2', false, ['deriveKey'])

  cryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000, // 关键安全参数（推荐 > 100,000）
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 }, // 生成 256 位密钥
    true, // 可导出（如果需要存储）
    ['encrypt', 'decrypt']
  )

  return cryptoKey
}
