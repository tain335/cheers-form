import { isArray, isBoolean, isNumber } from 'lodash';
import { FormType } from './form';
import { BaseField } from './field';

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

// https://github.com/vuejs/core/blob/main/packages/reactivity/src/reactive.ts
export function markRaw(instance: any) {
  Object.defineProperties(instance, {
    __v_skip: {
      value: true,
    },
  });
}

export function targetField(form: FormType<Record<string, any>>, name: string) {
  if (name === '*') {
    return form as BaseField<unknown>;
  }
  const fieldNames = name.split('.');
  let field: any = form;
  while (fieldNames.length) {
    const fieldName = fieldNames.shift();
    if (fieldName === '$') {
      field = field.$parent;
    } else {
      field = field[fieldName as string];
    }
  }
  return field as BaseField<unknown>;
}
