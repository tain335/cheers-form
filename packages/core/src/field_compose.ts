import { union } from 'lodash';
import { ChildrenState } from './child_state';
import { NonEnumerable } from './decorator';
import { Effect } from './effect';
import { BaseField, BaseFieldOpts, EachFieldCallback, EffectSource, EffectState, IDENTITY } from './field';
import { FieldState, FieldStateOpts, ValidType } from './field_state';

export type FieldComposeStateOpts<T> = FieldStateOpts<T> & { childrenState: ChildrenState };

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

  constructor(value: T, raw: any, children: ChildType, opts?: FieldComposeOpts<T>) {
    super(value, opts);
    this.$children = children;
    this.$state = new FieldComposeState({
      value,
      raw: this.$children,
      required: opts?.required ?? false,
      disabled: opts?.disabled ?? false,
      ignore: opts?.ignore ?? false,
      childrenState: this.$mergeChildState(raw),
    });
  }

  @NonEnumerable
  get $valid() {
    if (this.$state.$childrenState.$valid !== ValidType.Valid) {
      return this.$state.$childrenState.$valid;
    }
    return super.$valid;
  }

  @NonEnumerable
  get $message() {
    if (this.$state.$childrenState.$valid !== ValidType.Valid) {
      return this.$state.$childrenState.$invalidFields[0].$message;
    }
    return super.$message;
  }

  @NonEnumerable
  get $error() {
    if (this.$state.$childrenState.$valid !== ValidType.Valid) {
      return this.$state.$childrenState.$invalidFields[0].$error;
    }
    return super.$error;
  }

  @NonEnumerable
  get $childrenState() {
    return this.$state.$childrenState;
  }

  @NonEnumerable
  $getEffectSources(effect: Effect<BaseField<unknown>>): EffectSource[] {
    const currentSources = super.$getEffectSources(effect);
    return currentSources.concat(this.$state.$childrenState.$effectSources.get(effect) ?? []);
  }

  @NonEnumerable
  $firstNotValidEffectState(self?: boolean) {
    let firstUnknownState: EffectState | null = null;
    const effects = this.$getEffects(self);
    for (const effect of effects) {
      const sources = this.$state.$childrenState.$effectSources.get(effect);
      if (sources) {
        for (const source of sources) {
          if (source.state.valid === ValidType.Invalid) {
            return source.state;
          }
          if (!firstUnknownState && source.state.valid === ValidType.Unknown) {
            firstUnknownState = source.state;
          }
        }
      }
    }
    for (const effect of effects) {
      const state = this.$effectState.get(effect);
      if (state?.valid === ValidType.Invalid) {
        return state;
      }
      if (!firstUnknownState && state?.valid === ValidType.Unknown) {
        firstUnknownState = state;
      }
    }
    return firstUnknownState;
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

  // selfValid 定义是这个group下所有validator的校验状态集合，剔除所有外部的validator
  // valid 就是所有的validator的校验状态集合
  // childState 就是剔除group自身的validator后的校验状态 + raw改变
  // 为什么要这么做？因为这样当前group validator受自身validator和parent validator结果影响，从而导致不停的循环校验
  @NonEnumerable
  get $selfValid() {
    let valid = this.$state.$childrenState.$valid;
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
      this.$setState(this.$mergeState(false));
      field.$pushValidators('all', true);
    };
    traverse(this as BaseField<unknown>);
    if (this.$parent) {
      this.$parent.$rebuildState(false);
    }
    return this.$waitForExecutorDone().then(() => ({
      $valid: this.$valid,
      $selfValid: this.$selfValid,
      ...this.$state,
    }));
  }

  @NonEnumerable
  $onValidateSelf() {
    this.$pushValidators('all', true);
    if (this.$parent) {
      this.$parent.$rebuildState(false);
    }
    return this.$waitForExecutorDone().then(() => ({
      $valid: this.$valid,
      $selfValid: this.$selfValid,
      ...this.$state,
    }));
  }

  @NonEnumerable
  $change(raw: ChildType, manual = false) {
    if (raw !== this.$raw) {
      this.$modified = true;
      if (manual) {
        this.$manualModified = true;
      }
      this.$children = raw;
      this.$eachField((field) => {
        // @ts-ignore
        field.$parent = this;
        return true;
      });
      this.$setState(this.$mergeState(true));
      this.$pushValidators('change');
      if (this.$parent) {
        this.$parent.$rebuildState(true);
      }
    }
  }

  @NonEnumerable
  $onChange(raw: ChildType): void {
    if (this.$state.$disabled) {
      return;
    }
    this.$change(raw, true);
  }

  @NonEnumerable
  $mergeChildState(raw: any) {
    const childEffectSources: Map<any, EffectSource[]> = new Map();
    const currentEffects = new Set(this.$getEffects());
    let valid = ValidType.Valid;
    const unknownFields: BaseField<unknown>[] = [];
    const invalidFields: BaseField<unknown>[] = [];
    this.$eachField((field, key) => {
      if (field.$state.$ignore) {
        return true;
      }
      // copy group child effect state
      if (field instanceof FieldCompose) {
        unknownFields.push(...field.$state.$childrenState.$unknownFields);
        invalidFields.push(...field.$state.$childrenState.$invalidFields);
        field.$state.$childrenState.$effectSources.forEach((value, effect) => {
          if (!childEffectSources.get(effect)) {
            childEffectSources.set(effect, [...value]);
          } else {
            childEffectSources.get(effect)?.push(...value);
          }
        });
      }

      const effects = field.$getEffects();
      for (const effect of effects) {
        const sources = field.$getEffectSources(effect);
        const effectStates = childEffectSources.get(effect);
        if (!effectStates) {
          childEffectSources.set(effect, sources);
        } else {
          effectStates.push(...sources);
          childEffectSources.set(effect, effectStates);
        }
      }
      return true;
    });

    childEffectSources.forEach((sources, effect) => {
      if (!currentEffects.has(effect)) {
        sources.forEach((source) => {
          if (valid !== ValidType.Invalid && source.state?.valid === ValidType.Invalid) {
            invalidFields.push(source.field);
            valid = ValidType.Invalid;
          } else if (source.state?.valid === ValidType.Unknown) {
            unknownFields.push(source.field);
            valid = ValidType.Unknown;
          }
        });
      }
    });

    const newChidrenState: ChildrenState = new ChildrenState(
      valid,
      raw,
      childEffectSources,
      union(unknownFields),
      union(invalidFields),
    );
    return newChidrenState;
  }

  abstract $mergeState(rawChanged: boolean, opts?: Partial<FieldComposeStateOpts<T>>): FieldComposeState<T>;

  @NonEnumerable
  $rebuildState(rawChanged: boolean) {
    this.$setState(this.$mergeState(rawChanged));
    this.$pushValidators('change');
    if (this.$parent) {
      this.$parent.$rebuildState(rawChanged);
    }
  }

  abstract $eachField(callback: EachFieldCallback<any>): void;
}
