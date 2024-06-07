import { NonEnumerable } from './decorator';
import { Effect } from './effect';
import { BaseField } from './field';
import { genId } from './id';
import { Validator } from './validator';

export enum ValidType {
  Unknown = 0,
  Valid = 1,
  Invalid = 2,
}

export type FieldStateOpts<T> = { value: T | undefined; raw: any; disabled: boolean; ignore: boolean };

export class FieldState<T> {
  @NonEnumerable
  $value: T | undefined;

  @NonEnumerable
  $raw: any;

  // 无法修改值
  @NonEnumerable
  $disabled = false;

  // 不参与校验和输出
  @NonEnumerable
  $ignore = false;

  constructor(opts: FieldStateOpts<T>) {
    this.$value = opts.value;
    this.$raw = opts.raw;
    this.$ignore = opts.ignore;
    this.$disabled = opts.disabled;
  }
}

export class StateNode<T> {
  @NonEnumerable
  $id: number;

  @NonEnumerable
  $effects: Effect<any>[] = [];

  @NonEnumerable
  $parent?: StateNode<unknown>;

  @NonEnumerable
  $state: FieldState<T>;

  @NonEnumerable
  $field: BaseField<T>;

  get $value() {
    return this.$state.$value;
  }

  get $raw() {
    return this.$state.$raw;
  }

  constructor(field: BaseField<T>, state: FieldState<T>, effects: Effect<any>[] = []) {
    this.$id = genId();
    this.$field = field;
    this.$state = state;
    this.$effects = effects;
  }
}

// type ToStates<T> = T extends Array<any>
//   ? StateArrayNode<T>
//   : T extends object
//   ? StateGroupNode<T>
//   : T extends undefined
//   ? never
//   : ToState<T>;

// type StateArrayChildrenType<T extends Array<any>> = Array<ToStates<T[number]>>;

// export interface StateArrayNode<T extends Array<any> = unknown[]> extends FieldArrayChildrenType<T> {}

// export class StateArrayNode<T extends Array<any>> extends StateNode<T> {
//   @NonEnumerable
//   $children: StateArrayChildrenType<T> = [];

//   constructor(field: BaseField<T>, stateSyncSeq: number, fieldState: FieldState<T>, effects: Effect[] = []) {
//     super(field, stateSyncSeq, fieldState, effects);
//     return new Proxy(this, {
//       get(target, p) {
//         if (p in target.$children) {
//           return target.$children[p as keyof typeof target.$children];
//         }
//         return target[p as keyof typeof target];
//       },
//     });
//   }
// }

// type ToState<T> = T extends boolean ? StateNode<boolean> : T extends any ? StateNode<T> : never;

// export type StateGroupChildrenType<T extends object> = {
//   [K in keyof T]: ToStates<T[K]>;
// };

// export type StateGroupNode<T extends object = object> = $StateGroupNode<T> & StateGroupChildrenType<T>;

// export class $StateGroupNode<T extends object = object> extends StateNode<T> {
//   @NonEnumerable
//   $children: StateGroupChildrenType<T> = {} as StateGroupChildrenType<T>;

//   constructor(field: BaseField<T>, stateSyncSeq: number, fieldState: FieldState<T>, effects: Effect[] = []) {
//     super(field, stateSyncSeq, fieldState, effects);
//     return new Proxy(this, {
//       get(target, p) {
//         if (p in target.$children) {
//           return target.$children[p as keyof typeof target.$children];
//         }
//         return target[p as keyof typeof target];
//       },
//     });
//   }
// }
