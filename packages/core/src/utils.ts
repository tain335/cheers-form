import { isNull, isUndefined } from 'lodash';

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
