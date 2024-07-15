import { NonEnumerable } from './decorator';
import { ValidType } from './field_state';
import { BaseField, BaseFieldOpts, EachFieldCallback, Field, IDENTITY } from './field';
import { FieldCompose, FieldComposeOpts, FieldComposeState } from './field_compose';
import { ToFields } from './types';
import { ChildrenState } from './child_state';

// 这里要omit receive 和 transform
export type FieldArrayOpts<T> = Omit<BaseFieldOpts<T>, 'receive' | 'transform'>;

export type FieldArrayChildrenType<T extends Array<any>> = Array<ToFields<T[number]>>;

export interface FieldArray<T extends Array<any>> extends FieldArrayChildrenType<T> {}

export class FieldArray<T extends Array<any>> extends FieldCompose<T, FieldArrayChildrenType<T>> {
  constructor(children: FieldArrayChildrenType<T>, opts?: FieldArrayOpts<T>) {
    const value = children.map((c) => c.$state.$value) as T;
    const raw = children.map((c) => c.$state.$raw);
    super(value, raw, children, {
      ...opts,
      transform: (raw: FieldArrayChildrenType<T>) =>
        raw.map((c: FieldArrayChildrenType<T>[number]) => c.$state.$value) as T,
    });
    this.$children = children;
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
      set(target, p, newValue, receiver) {
        if (!Number.isNaN(Number(p))) {
          let modified = false;
          if (target.$children[Number(p)] !== newValue) {
            if (newValue instanceof BaseField) {
              newValue.$parent = proxy as any;
            }
            modified = true;
          }
          if (modified) {
            target.$children[Number(p)] = newValue;
            proxy.$rebuildState(true);
          } else {
            target.$children[Number(p)] = newValue;
          }
        } else if (p in []) {
          target.$children[p as any] = newValue;
        } else {
          target[p as any] = newValue;
        }
        return true;
      },
      deleteProperty(target, p) {
        if (!Number.isNaN(Number(p))) {
          const deleteValue = target.$children[Number(p)];
          if (deleteValue instanceof BaseField) {
            deleteValue.$parent = undefined;
          }
          proxy.$rebuildState(true);
        }
        const result = Reflect.deleteProperty(target.$children, p);
        return result;
      },
    });
    this.$children.forEach((child) => {
      child.$parent = proxy as any;
    });
    proxy.$initEffectsState(opts?.valid ?? ValidType.Valid);
    this.$initial = {
      value: this.$children.slice(),
      valid: opts?.valid ?? ValidType.Valid,
    };
    return proxy;
  }

  @NonEnumerable
  $mergeState(rawChanged: boolean, opts?: Partial<FieldComposeOpts<T>>): FieldComposeState<T> {
    const newValue = [] as unknown as T;
    let newRaw: any[] = [];
    this.$eachField((field) => {
      if (field.$state.$ignore) {
        return true;
      }
      newValue.push(field.$value);
      newRaw.push(field.$raw);
      return true;
    });
    if (!rawChanged) {
      newRaw = this.$state.$childrenState.$raw;
    }
    const newChidrenState: ChildrenState = this.$mergeChildState(newRaw);

    return new FieldComposeState({
      raw: this.$children,
      value: newValue,
      disabled: this.$state.$disabled,
      ignore: this.$state.$ignore,
      required: this.$state.$required,
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

  @NonEnumerable
  $onReset(): void {
    super.$onReset();
    this.$children = this.$initial.value;
    this.$eachField((field) => {
      field.$onReset();
      return true;
    });
    this.$initEffectsState(this.$initial.valid);
    this.$rebuildState(false);
  }
}
