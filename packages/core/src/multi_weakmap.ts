export class MultiWeakMap<K extends any[], V> {
  rootMap: WeakMap<any, any>;

  constructor() {
    this.rootMap = new WeakMap<any, any>();
  }

  set(keys: K, value: V) {
    let currentMap = this.rootMap;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!currentMap.has(keys[i])) {
        currentMap.set(keys[i], new WeakMap<any, any>());
      }
      currentMap = currentMap.get(keys[i]);
    }

    currentMap.set(keys[keys.length - 1], value);
  }

  get(keys: K) {
    let currentMap = this.rootMap;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!currentMap.has(keys[i])) {
        return undefined;
      }
      currentMap = currentMap.get(keys[i]);
    }

    return currentMap.get(keys[keys.length - 1]);
  }

  has(keys: K) {
    let currentMap = this.rootMap;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!currentMap.has(keys[i])) {
        return false;
      }
      currentMap = currentMap.get(keys[i]);
    }

    return currentMap.has(keys[keys.length - 1]);
  }

  delete(keys: K) {
    let currentMap = this.rootMap;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!currentMap.has(keys[i])) {
        return false;
      }
      currentMap = currentMap.get(keys[i]);
    }

    return currentMap.delete(keys[keys.length - 1]);
  }
}
