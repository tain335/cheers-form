import { UpdateFieldStateCallback } from './executor';
import { BaseField } from './field';
import { MultiWeakMap } from './multi_weakmap';

export enum EffectType {
  Change = 0,
  Validate = 1,
}

export type Effect<T extends BaseField<any>> = {
  id: string;
  seq: number;
  deps?: any[];
  affectedFields: BaseField<unknown>[];
  type: EffectType;
  watch: (field: T) => any[];
  beforeApply?: () => void;
  apply: (field: T, updateField: UpdateFieldStateCallback) => Promise<void>;
  afterApply?: () => void;
};

export function effect<T extends BaseField<any>>({
  action,
  watch,
}: {
  action: Effect<T>['apply'];
  watch?: Effect<T>['watch'];
}) {
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
