/**
 * 遍历 storage
 * @param storage  要遍历的存储API
 * @param callback 回调
 */
export function forEach(storage: Storage, callback: (key: string, value: string) => void) {
  const length = storage.length

  for (let i = 0; i < length; i++) {
    const key = storage.key(i)
    const value = storage.getItem(key!)

    callback(key!, value!)
  }
}
