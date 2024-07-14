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
  affectedFields: BaseField<unknown>[];
  type: EffectType;
  watch: (field: T) => any[];
  predict: (field: T) => boolean;
  beforeApply?: () => void;
  apply: (field: T, updateField: UpdateFieldStateCallback) => Promise<void>;
  afterApply?: () => void;
};

export function effect<T extends BaseField<any>>({
  action,
  watch,
  predict,
}: {
  action: Effect<T>['apply'];
  watch?: Effect<T>['watch'];
  predict?: Effect<T>['predict'];
}) {
  return {
    deps: [],
    fields: [],
    stage: EffectType.Change,
    watch,
    action,
    predict,
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
