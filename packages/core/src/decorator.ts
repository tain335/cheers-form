export function NonEnumerable(target: any, propertyKey: any) {
  Object.defineProperty(target, propertyKey, {
    enumerable: false,
    configurable: true,
    writable: true,
  });
}
