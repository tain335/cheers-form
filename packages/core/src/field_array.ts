import { NonEnumerable } from './decorator';
import { ValidType } from './field_state';
import { BaseField, BaseFieldOpts, EachFieldCallback, Field, IDENTITY } from './field';
import { ChildrenState, GroupFieldState, FieldGroupStateOpts, ToFields } from './field_group';
import { debug } from './log';
import { FieldCompose } from './field_compose';

// 这里要omit receive 和 transform
export type FieldArrayOpts<T> = Omit<BaseFieldOpts<T>, 'receive' | 'transform'>;

export type FieldArrayChildrenType<T extends Array<any>> = Array<ToFields<T[number]>>;

export interface FieldArray<T extends Array<any>> extends FieldArrayChildrenType<T> {}

export class FieldArray<T extends Array<any>> extends FieldCompose<T, FieldArrayChildrenType<T>> {
  constructor(children: FieldArrayChildrenType<T>, opts?: FieldArrayOpts<T>) {
    const value = children.map((c) => c.$state.$value) as T;
    super(value, children, {
      ...opts,
      transform: (raw: FieldArrayChildrenType<T>) =>
        raw.map((c: FieldArrayChildrenType<T>[number]) => c.$state.$value) as T,
    });
    this.$children = children;
    this.$children.forEach((child) => {
      // @ts-ignore
      child.$parent = this;
    });
    const proxy = new Proxy(this, {
      get(target, p) {
        if (p === IDENTITY) {
          return target;
        }
        if (p in target.$children) {
          return target.$children[p as any];
        }
        return target[p as any];
      },
      set(target, p, newValue) {
        if (typeof p === 'number') {
          target.$children[p] = newValue;
        } else if (p in []) {
          target.$children[p as any] = newValue;
        } else {
          target[p as any] = newValue;
        }
        return true;
      },
    });
    proxy.$initEffectsState(opts?.valid ?? ValidType.Valid);
    return proxy;
  }

  @NonEnumerable
  $mergeState(opts?: Partial<FieldGroupStateOpts<T>>): GroupFieldState<T> {
    let newValue = [] as unknown as T;
    if (!opts?.value) {
      this.$eachField((field) => {
        if (field.$state.$ignore) {
          return true;
        }
        newValue.push(field.$value);
        return true;
      });
    } else {
      newValue = opts.value;
    }

    const newChidrenState: ChildrenState = this.$mergeChildState();

    return new GroupFieldState({
      raw: this.$children,
      value: newValue,
      disabled: this.$state.$disabled,
      ignore: this.$state.$ignore,
      childrenState: newChidrenState,
      ...opts,
    });
  }

  @NonEnumerable
  $eachField(callback: EachFieldCallback<T[number]>) {
    this.$children.forEach((field, index) => {
      callback(field, index);
    });
  }
}
