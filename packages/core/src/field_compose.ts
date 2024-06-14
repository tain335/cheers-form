import { NonEnumerable } from './decorator';
import { BaseField, BaseFieldOpts, EachFieldCallback, IDENTITY } from './field';
import { FieldState, FieldStateOpts, ValidType } from './field_state';

export type FieldComposeStateOpts<T> = FieldStateOpts<T> & { childrenState: ChildrenState };

export type ChildrenState = {
  $valid: ValidType;
  $issueFields: BaseField<unknown>[];
};

export type FieldComposeOpts<T> = BaseFieldOpts<T>;

export class FieldComposeState<T> extends FieldState<T> {
  @NonEnumerable
  $childrenState: ChildrenState;

  constructor(opts: FieldComposeStateOpts<T>) {
    super(opts);
    this.$childrenState = opts.childrenState;
  }

  isEqual(newState: FieldComposeState<T>): boolean {
    return this.$childrenState === newState.$childrenState && super.isEqual(newState);
  }
}

export abstract class FieldCompose<T, ChildType> extends BaseField<T> {
  @NonEnumerable
  $state: FieldComposeState<T>;

  @NonEnumerable
  $children: ChildType;

  constructor(value: T, children: ChildType, opts?: FieldComposeOpts<T>) {
    super(value, opts);
    this.$children = children;
    this.$state = new FieldComposeState({
      value,
      raw: this.$children,
      disabled: opts?.disabled ?? false,
      ignore: opts?.ignore ?? false,
      childrenState: this.$mergeChildState(),
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
  get $selfValid() {
    let valid = ValidType.Valid as ValidType;
    this.$eachField((field) => {
      if (field.$selfValid === ValidType.Invalid) {
        valid = ValidType.Invalid;
        return false;
      }
      if (field.$selfValid === ValidType.Unknown) {
        valid = ValidType.Unknown;
      }
      return true;
    });
    if (valid !== ValidType.Invalid) {
      const state = this.$firstNotValidEffectState(true);
      if (state?.valid === ValidType.Invalid) {
        valid = state.valid;
      }
      if (state?.valid === ValidType.Unknown) {
        valid = state.valid;
      }
    }
    return valid;
  }

  @NonEnumerable
  $onValidate() {
    const traverse = (field: BaseField<unknown>) => {
      if (this instanceof FieldCompose) {
        field.$eachField((f) => {
          traverse(f);
          return true;
        });
      }
      field.$pushValidators('all', true);
    };
    this.$eachField((field) => {
      field.$pushValidators('all', true);
      return true;
    });
    traverse(this as BaseField<unknown>);
    return this.$waitForExecutorDone().then(() => ({
      $valid: this.$valid,
      $selfValid: this.$selfValid,
      ...this.$state,
    }));
  }

  @NonEnumerable
  $onChange(raw: ChildType): void {
    if (this.$state.$disabled) {
      return;
    }
    if (raw !== this.$raw) {
      this.$children = raw;
      this.$eachField((field) => {
        // @ts-ignore
        field.$parent = this;
        return true;
      });
      this.$setState(this.$mergeState());
      this.$pushValidators('change');
      if (this.$parent) {
        this.$parent.$rebuildState();
      }
    }
  }

  @NonEnumerable
  $mergeChildState() {
    const newChidrenState: ChildrenState = { $valid: ValidType.Valid, $issueFields: [] };
    this.$eachField((field, key) => {
      if (field.$state.$ignore) {
        return true;
      }
      if (field.$valid === ValidType.Invalid && newChidrenState.$valid !== ValidType.Invalid) {
        newChidrenState.$valid = ValidType.Invalid;
        newChidrenState.$issueFields.push(field as BaseField<unknown>);
      } else if (field.$valid === ValidType.Unknown && newChidrenState.$valid !== ValidType.Invalid) {
        newChidrenState.$valid = ValidType.Unknown;
      }
      return true;
    });
    return newChidrenState;
  }

  abstract $mergeState(opts?: Partial<FieldComposeStateOpts<T>>): FieldComposeState<T>;

  @NonEnumerable
  $rebuildState() {
    this.$setState(this.$mergeState());
    this.$pushValidators('change');
    if (this.$parent) {
      this.$parent.$rebuildState();
    }
  }

  abstract $eachField(callback: EachFieldCallback<any>): void;
}
