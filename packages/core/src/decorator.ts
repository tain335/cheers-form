export function NonEnumerable(target: any, key: any) {
  Object.defineProperty(target, key, {
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

export function Memo(target: any, key: any, descriptor: any) {
  let called = false;
  let result: any;
  const func = descriptor.value;
  descriptor.value = function (...args: any[]) {
    if (called) {
      return result;
    }
    if (!called) {
      called = true;
      result = Reflect.apply(func, this, args);
    }
    return result;
  };
}
