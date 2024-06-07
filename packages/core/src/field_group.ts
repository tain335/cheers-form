import { NonEnumerable } from './decorator';
import { BaseField, BaseFieldOpts, EachFieldCallback, Field, IDENTITY } from './field';
import { FieldArray } from './field_array';
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

export type GroupFieldStateOpts<T> = FieldStateOpts<T> & { childrenState: ChildrenState };

export class GroupFieldState<T> extends FieldState<T> {
  @NonEnumerable
  $childrenState: ChildrenState;

  constructor(opts: GroupFieldStateOpts<T>) {
    super(opts);
    this.$childrenState = opts.childrenState;
  }
}

export class $FieldGroup<T extends object> extends BaseField<T> {
  @NonEnumerable
  $children: FieldGroupChildrenType<T>;

  @NonEnumerable
  $state: GroupFieldState<T>;

  constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
    const value = Object.keys(children).reduce((p: any, k) => {
      p[k] = children[k as keyof typeof children].$value;
      return p;
    }, {} as T);
    super(value, {
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

    return new Proxy(this, {
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
  }

  get $valid() {
    if (this.$state.$childrenState.$valid !== ValidType.Valid) {
      return this.$state.$childrenState.$valid;
    }
    return super.$valid;
  }

  get $message() {
    if (this.$state.$childrenState.$valid !== ValidType.Valid) {
      return this.$state.$childrenState.$issueFields[0].$message;
    }
    return super.$message;
  }

  get $error() {
    if (this.$state.$childrenState.$valid !== ValidType.Valid) {
      return this.$state.$childrenState.$issueFields[0].$error;
    }
    return super.$error;
  }

  $self(): this {
    // @ts-ignore
    if (this[IDENTITY]) {
      // @ts-ignore
      return this[IDENTITY];
    }
    return this;
  }

  @NonEnumerable
  $onChange(raw: FieldGroupChildrenType<T>): void {
    if (this.$state.$disabled) {
      return;
    }
    if (raw !== this.$raw) {
      this.$children = raw;
      this.$eachField((field) => {
        // @ts-ignore
        field.$parent = this;
      });
      this.$pushValidators('change');
      this.$setState(this.$mergeState());
      this.$markDirty();
    }
  }

  @NonEnumerable
  $mergeChildState() {
    const newChidrenState: ChildrenState = { $valid: ValidType.Valid, $issueFields: [] };
    this.$eachField((field, key) => {
      if (field.$state.$ignore) {
        return;
      }
      if (field.$valid === ValidType.Invalid && newChidrenState.$valid !== ValidType.Invalid) {
        newChidrenState.$valid = ValidType.Invalid;
        newChidrenState.$issueFields.push(field as BaseField<unknown>);
      } else if (field.$valid === ValidType.Unknown && newChidrenState.$valid !== ValidType.Unknown) {
        newChidrenState.$valid = ValidType.Unknown;
      }
    });
    return newChidrenState;
  }

  @NonEnumerable
  $mergeState(opts?: Partial<GroupFieldStateOpts<T>>): GroupFieldState<T> {
    const newValue = {} as unknown as T;
    this.$eachField((field, key) => {
      if (field.$state.$ignore) {
        return;
      }
      newValue[key as keyof T] = field.$value;
    });
    const newChidrenState: ChildrenState = this.$mergeChildState();

    return new GroupFieldState({
      raw: this.$children,
      value: newChidrenState.$valid === ValidType.Valid ? newValue : this.$state.$value,
      disabled: this.$state.$disabled,
      ignore: this.$state.$ignore,
      childrenState: newChidrenState,
      ...opts,
    });
  }

  @NonEnumerable
  $rebuildState() {
    this.$setState(this.$mergeState());
  }

  @NonEnumerable
  $eachField(callback: EachFieldCallback<any>) {
    Object.keys(this.$children).forEach((key) => {
      const field = this.$children[key as keyof typeof this.$children];
      callback(field, key);
    });
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
