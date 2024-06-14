import { NonEnumerable } from './decorator';
import { BaseField, BaseFieldOpts, EachFieldCallback, Field, IDENTITY } from './field';
import { FieldArray } from './field_array';
import { FieldCompose } from './field_compose';
import { FieldState, FieldStateOpts, ValidType } from './field_state';

// union 分发的特性
type ToField<T> = T extends boolean ? Field<boolean> : T extends any ? Field<T> : never;

export type ToFields<T> = T extends Array<any> ? FieldArray<T> : T extends object ? FieldGroup<T> : ToField<T>;

export type FieldGroupOpts<T> = Omit<BaseFieldOpts<T>, 'receive' | 'transform'>;

export type FieldGroupChildrenType<T extends object> = {
  [K in Exclude<keyof T, undefined>]: ToFields<Exclude<T[K], undefined>>;
};

export type ChildrenState = {
  $valid: ValidType;
  $issueFields: BaseField<unknown>[];
};

export type FieldGroupStateOpts<T> = FieldStateOpts<T> & { childrenState: ChildrenState };

export class GroupFieldState<T> extends FieldState<T> {
  @NonEnumerable
  $childrenState: ChildrenState;

  constructor(opts: FieldGroupStateOpts<T>) {
    super(opts);
    this.$childrenState = opts.childrenState;
  }

  isEqual(newState: GroupFieldState<T>): boolean {
    return this.$childrenState === newState.$childrenState && super.isEqual(newState);
  }
}

export class $FieldGroup<T extends object> extends FieldCompose<T, FieldGroupChildrenType<T>> {
  constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
    const value = Object.keys(children).reduce((p: any, k) => {
      p[k] = children[k as keyof typeof children].$value;
      return p;
    }, {} as T);
    super(value, children, {
      ...opts,
      transform: (raw: any) =>
        Object.keys(raw).reduce((p: any, k) => {
          p[k] = raw[k].value;
          return p;
        }, {} as T),
    });
    this.$children = children;
    this.$state = new GroupFieldState({
      value,
      raw: this.$children,
      disabled: opts?.disabled ?? false,
      ignore: opts?.ignore ?? false,
      childrenState: this.$mergeChildState(),
    });
    // set parent
    Object.values(this.$children).forEach((child: any) => {
      child.$parent = this;
    });
    const proxy = new Proxy(this, {
      set(target, p, newValue, receiver) {
        if (p in target.$children) {
          target.$children[p as Exclude<keyof T, undefined>] = newValue;
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
    });
    proxy.$initEffectsState(opts?.valid ?? ValidType.Valid);
    return proxy;
  }

  @NonEnumerable
  $mergeState(opts?: Partial<FieldGroupStateOpts<T>>): GroupFieldState<T> {
    const newValue = {} as unknown as T;
    this.$eachField((field, key) => {
      if (field.$state.$ignore) {
        return true;
      }
      newValue[key as keyof T] = field.$value;
      return true;
    });
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
  $eachField(callback: EachFieldCallback<any>) {
    for (const key of Object.keys(this.$children)) {
      const field = this.$children[key as keyof typeof this.$children];
      const continued = callback(field, key);
      if (!continued) {
        break;
      }
    }
  }
}

export type FieldGroup<T extends object> = FieldGroupChildrenType<T> & $FieldGroup<T>;

function Wrapper<T extends object>(): new <T extends object = Record<string, unknown>>(
  children: FieldGroupChildrenType<T>,
  opts?: FieldGroupOpts<T>,
) => FieldGroupChildrenType<T> & $FieldGroup<T> {
  return class {
    constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
      return new $FieldGroup(children, opts);
    }
  } as any;
}

export const FieldGroup = Wrapper();
