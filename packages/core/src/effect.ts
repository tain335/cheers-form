import { UpdateFieldStateCallback } from './executor';
import { BaseField } from './field';
import { MultiWeakMap } from './multi_weakmap';

export enum EffectType {
  Change = 0,
  Validate = 1,
}

export type Effect<T extends BaseField<any>> = {
  id: string;
  deps?: any[];
  fields: BaseField<unknown>[];
  type: EffectType;
  watch: (field: T) => any[];
  apply: (field: T, updateField: UpdateFieldStateCallback) => Promise<void>;
};

export function effect<T extends BaseField<any>>(action: Effect<T>['apply'], watch?: Effect<T>['watch']) {
  return {
    deps: [],
    fields: [],
    stage: EffectType.Change,
    watch,
    action,
  };
}

const effectMap = new MultiWeakMap<any[], Effect<BaseField<any>>>();

export function getEffect(target: any[], initial?: () => Effect<BaseField<any>>): Effect<BaseField<any>> | undefined {
  let result = effectMap.get(target);
  if (!result && initial) {
    result = initial();
    effectMap.set(target, result);
  }
  return result;
}
