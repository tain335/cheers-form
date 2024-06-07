import { NonEnumerable } from './decorator';
import { ValidType } from './field_state';
import { BaseField, BaseFieldOpts, EachFieldCallback, Field, IDENTITY } from './field';
import { ChildrenState, GroupFieldState, GroupFieldStateOpts, ToFields } from './field_group';
import { debug } from './log';

// 这里要omit receive 和 transform
export type FieldArrayOpts<T> = Omit<BaseFieldOpts<T>, 'receive' | 'transform'>;

export type FieldArrayChildrenType<T extends Array<any>> = Array<ToFields<T[number]>>;

export interface FieldArray<T extends Array<any>> extends FieldArrayChildrenType<T> {}

export class FieldArray<T extends Array<any>> extends BaseField<T> {
  @NonEnumerable
  $children: FieldArrayChildrenType<T>;

  @NonEnumerable
  $state: GroupFieldState<T>;

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

  constructor(children: FieldArrayChildrenType<T>, opts?: FieldArrayOpts<T>) {
    const value = children.map((c) => c.$state.$value) as T;
    super(value, {
      ...opts,
      transform: (raw: FieldArrayChildrenType<T>) =>
        raw.map((c: FieldArrayChildrenType<T>[number]) => c.$state.$value) as T,
    });
    this.$children = children;
    this.$children.forEach((child) => {
      // @ts-ignore
      child.$parent = this;
    });
    this.$state = new GroupFieldState({
      value,
      raw: this.$children,
      disabled: opts?.disabled ?? false,
      ignore: opts?.ignore ?? false,
      childrenState: this.$megerChildState(),
    });
    return new Proxy(this, {
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
  }

  @NonEnumerable
  $self(): this {
    // @ts-ignore
    if (this[IDENTITY]) {
      // @ts-ignore
      return this[IDENTITY];
    }
    return this;
  }

  @NonEnumerable
  $megerChildState() {
    const newChidrenState: ChildrenState = { $valid: ValidType.Valid, $issueFields: [] };
    this.$eachField((field) => {
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
    const newValue = [] as unknown as T;
    this.$eachField((field) => {
      if (field.$state.$ignore) {
        return;
      }

      newValue.push(field.$value);
    });

    const newChidrenState: ChildrenState = this.$megerChildState();

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
  $onChange(raw: FieldArrayChildrenType<T>): void {
    if (this.$state.$disabled) {
      return;
    }
    if (raw !== this.$raw) {
      debug('[FieldArray] change');
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
  $eachField(callback: EachFieldCallback<T[number]>) {
    this.$children.forEach((field, index) => {
      callback(field, index);
    });
  }

  @NonEnumerable
  $rebuildState() {
    this.$setState(this.$mergeState());
  }
}
