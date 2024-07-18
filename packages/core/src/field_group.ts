import { ChildrenState } from './child_state';
import { NonEnumerable } from './decorator';
import { BaseField, BaseFieldOpts, EachFieldCallback, IDENTITY } from './field';
import { FieldCompose, FieldComposeState, FieldComposeStateOpts } from './field_compose';
import { ValidType } from './field_state';
import { ToFields } from './types';

export type FieldGroupOpts<T> = Omit<BaseFieldOpts<T>, 'receive' | 'transform'>;

export type FieldGroupChildrenType<T extends object> = {
  [K in Exclude<keyof T, undefined>]: ToFields<Exclude<T[K], undefined>>;
};

export class $FieldGroup<T extends object> extends FieldCompose<T, FieldGroupChildrenType<T>> {
  constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
    const value: any = {};
    const raw: any = {};
    Object.keys(children).forEach((k) => {
      value[k] = children[k as keyof typeof children].$value;
      raw[k] = children[k as keyof typeof children].$raw;
      return value;
    });
    super(value, raw, children, {
      ...opts,
      transform: (raw: any) =>
        Object.keys(raw).reduce((p: any, k) => {
          p[k] = raw[k].value;
          return p;
        }, {} as T),
    });
    this.$children = children;
    this.$state = new FieldComposeState({
      value,
      raw: this.$children,
      disabled: opts?.disabled ?? false,
      ignore: opts?.ignore ?? false,
      required: opts?.required ?? false,
      childrenState: this.$mergeChildState(raw),
    });

    const proxy = new Proxy(this, {
      set(target, p, newValue) {
        let modified = false;
        if (p in target.$children) {
          if (newValue !== target.$children[p as Exclude<keyof T, undefined>]) {
            if (newValue instanceof BaseField) {
              newValue.$parent = proxy as any;
            }
            modified = true;
          }
          if (modified) {
            target.$children[p as Exclude<keyof T, undefined>] = newValue;
            proxy.$rebuildState(true);
          } else {
            target.$children[p as Exclude<keyof T, undefined>] = newValue;
          }
        } else {
          // @ts-ignore
          target[p as keyof $FieldGroup<T>] = newValue;
        }
        return true;
      },
      get(target, p, receiver) {
        if (p === IDENTITY) {
          return target;
        }
        if (p in target.$children) {
          return target.$children[p as Exclude<keyof T, undefined>];
        }
        return target[p as keyof $FieldGroup<T>];
      },
      deleteProperty(target, p) {
        if (p in target.$children) {
          const deleteValue = target.$children[p as Exclude<keyof T, undefined>];
          if (deleteValue instanceof BaseField) {
            deleteValue.$parent = undefined;
          }
          delete target.$children[p as Exclude<keyof T, undefined>];
          proxy.$rebuildState(true);
          return true;
        }
        return false;
      },
    });
    Object.values(this.$children).forEach((child: any) => {
      child.$parent = proxy;
    });
    const initialValid = this.$computeInitialValid(value, opts?.required, opts?.valid);
    this.$initial = {
      value: { ...this.$children },
      valid: initialValid,
    };
    proxy.$initEffectsState(initialValid);
    return proxy;
  }

  @NonEnumerable
  $mergeState(rawChanged: boolean, opts?: Partial<FieldComposeStateOpts<T>>): FieldComposeState<T> {
    const newValue = {} as unknown as T;
    let newRaw: any = {};
    this.$eachField((field, key) => {
      if (field.$state.$ignore) {
        return true;
      }
      newValue[key as keyof T] = field.$value;
      newRaw[key as keyof T] = field.$raw;
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
      required: this.$state.$required,
      ignore: this.$state.$ignore,
      childrenState: newChidrenState,
      ...opts,
    });
  }

  @NonEnumerable
  $eachField(callback: EachFieldCallback<any>) {
    for (const key of Object.keys(this.$children)) {
      const field = this.$children[key as keyof typeof this.$children];
      const continued = callback(field, key);
      if (!continued) {
        break;
      }
    }
  }

  @NonEnumerable
  $onReset(rebuildParent = true): void {
    super.$onReset();
    this.$children = this.$initial.value;
    this.$eachField((field) => {
      field.$onReset(false);
      return true;
    });
    this.$initEffectsState(this.$initial.valid);
    this.$setState(this.$mergeState(false));
    if (rebuildParent && this.$parent) {
      this.$parent.$rebuildState(false);
    }
  }
}

export type FieldGroup<T extends object> = FieldGroupChildrenType<T> & $FieldGroup<T>;

function Factory<T extends object>(): new <T extends object = Record<string, unknown>>(
  children: FieldGroupChildrenType<T>,
  opts?: FieldGroupOpts<T>,
) => FieldGroup<T> {
  return class {
    constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
      return new $FieldGroup(children, opts);
    }
  } as any;
}

export const FieldGroup = Factory();
