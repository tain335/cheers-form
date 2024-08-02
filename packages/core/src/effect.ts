import { UpdateFieldStateCallback } from './executor';
import { BaseField } from './field';
import { HookSource } from './hook_state';
import { MultiWeakMap } from './multi_weakmap';

export enum EffectType {
  Sync = 1,
  Async = 2,
}

export type Effect<T extends BaseField<any>> = {
  // id: string;
  seq: number;
  owner?: BaseField<unknown>;
  deps?: any[];
  affectedFields: BaseField<unknown>[];
  type: EffectType;
  watch: (field: T) => any[];
  apply: (field: T, updateField: UpdateFieldStateCallback) => Promise<void>;
};

export function changeEffect<T extends BaseField<any>>({
  action,
  watch,
}: {
  action: Effect<T>['apply'];
  watch?: Effect<T>['watch'];
}) {
  return {
    deps: [],
    fields: [],
    stage: EffectType.Sync,
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
