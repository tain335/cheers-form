import { isArray, isBoolean, isNumber } from 'lodash';

export abstract class DependencyCompare {
  abstract isEqual(other: DependencyCompare): boolean;
}

export function isDependenciesEqual(newDependencies: any[], oldDependencies: any[]) {
  if (newDependencies === oldDependencies) {
    return true;
  }
  if (newDependencies.length !== oldDependencies.length) {
    return false;
  }
  for (let i = 0; i < newDependencies.length; i++) {
    const newDep = newDependencies[i];
    const oldDep = oldDependencies[i];
    if (
      newDep instanceof DependencyCompare &&
      oldDep instanceof DependencyCompare &&
      Object.getPrototypeOf(newDep) === Object.getPrototypeOf(oldDep)
    ) {
      if (!newDep.isEqual(oldDep)) {
        return false;
      }
    } else if (newDependencies[i] !== oldDependencies[i]) {
      return false;
    }
  }
  return true;
}

export function isEmpty(value: any) {
  if (isArray(value)) {
    return value.length === 0;
  }
  if (isBoolean(value)) {
    return false;
  }
  if (isNumber(value)) {
    return false;
  }
  return !value;
}

export function addFlag(mark: number, flag: number) {
  return mark | flag;
}

export function removeFlag(mark: number, flag: number) {
  return mark & ~flag;
}

export function hasFlag(mark: number, flag: number) {
  return mark & flag;
}
