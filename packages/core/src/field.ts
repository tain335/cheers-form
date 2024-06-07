import { unionBy } from 'lodash';
import { NonEnumerable } from './decorator';
import { Effect, EffectType, getEffect } from './effect';
import { FieldState, FieldStateOpts, ValidType } from './field_state';
import { genId } from './id';
import { ValidateFieldState, Validator } from './validator';
import { FieldGroup } from './field_group';
import { FieldArray } from './field_array';
import { debug } from './log';

export const IDENTITY = Symbol('proxy_target_identity');

export type ReceiveCallback<T> = (v: T | undefined, initial: boolean) => any;

export type TransformCallback<T> = (v: any) => T;

export type BaseFieldOpts<T> = {
  disabled?: boolean;
  ignore?: boolean;
  valid?: ValidType;
  validators?: Validator<T>[];
  receive?: ReceiveCallback<T>;
  transform?: TransformCallback<T>;
};

export type EachFieldCallback<T> = (field: BaseField<T>, keyOrIndex?: string | number) => void;

type EffectState = {
  valid: ValidType;
  error?: Error;
  message?: string;
};

export class BaseField<T> {
  @NonEnumerable
  $id = genId();

  @NonEnumerable
  $parent?: FieldGroup<Record<string, unknown>> | FieldArray<unknown[]>;

  @NonEnumerable
  $validators: Validator<T>[] = [];

  @NonEnumerable
  $state: FieldState<T>;

  @NonEnumerable
  $dirty = false;

  @NonEnumerable
  $pendingEffects: Effect<BaseField<T>>[] = [];

  @NonEnumerable
  $effectState: WeakMap<any, EffectState> = new WeakMap();

  get $value(): T | undefined {
    return this.$state.$value;
  }

  set $value(v: T | undefined) {
    const newRaw = this.$receive(v, false);
    this.$raw = newRaw;
  }

  get $raw() {
    return this.$state.$raw;
  }

  set $raw(value) {
    this.$onChange(value);
  }

  get $valid(): ValidType {
    const state = this.$firstNotValidEffectState();
    if (state) {
      return state.valid;
    }
    return ValidType.Valid;
  }

  get $message(): string {
    const state = this.$firstNotValidEffectState();
    if (state) {
      return state.message ?? '';
    }
    return '';
  }

  get $error(): any {
    const state = this.$firstNotValidEffectState();
    if (state) {
      return state.error;
    }
    return null;
  }

  get $validState(): EffectState[] {
    const effects = this.$getEffects();
    return effects.map((effect) => this.$effectState.get(effect)).filter(Boolean) as EffectState[];
  }

  @NonEnumerable
  $receive: ReceiveCallback<T>;

  @NonEnumerable
  $transform: TransformCallback<T>;

  constructor(value: T | undefined, opts?: BaseFieldOpts<T>) {
    const receive = opts?.receive ?? ((v) => v);
    this.$receive = receive;
    this.$transform = opts?.transform ?? ((v: any) => v);
    this.$state = new FieldState({
      value,
      raw: receive(value, true),
      disabled: opts?.disabled ?? false,
      ignore: opts?.ignore ?? false,
    });
    this.$validators = opts?.validators ?? [];
    this.$initEffectsState(opts?.valid ?? ValidType.Valid);
  }

  @NonEnumerable
  $initEffectsState(valid: ValidType) {
    const effects = this.$getSelfEffects();
    if (valid !== ValidType.Valid) {
      effects.forEach((effect) => {
        this.$updateEffectState(effect, { valid });
      });
    }
  }

  @NonEnumerable
  $self() {
    return this;
  }

  @NonEnumerable
  $getInheritEffects() {
    let effects: Effect<BaseField<unknown>>[] = [];
    if (this.$parent) {
      effects = effects.concat(this.$parent.$getEffects());
    }
    return effects;
  }

  @NonEnumerable
  $getSelfEffects() {
    let effects: Effect<BaseField<unknown>>[] = [];
    if (this.$validators.length) {
      const validateEffects = this.$validators
        .map((validator) => {
          return getEffect([this.$self(), validator], () => ({
            id: `${this.$id}-${validator.id}`,
            type: EffectType.Validate,
            fields: [],
            watch(field) {
              if (validator.$watch) {
                return validator.$watch(field as unknown as ValidateFieldState<Partial<T>>);
              }
              // 如果是field是监听$raw 如果是其他监听 $value
              return this instanceof Field ? [field.$state.$raw] : [field.$state.$value];
            },
            async apply(field, updateField) {
              debug('[Field] apply effect');
              return validator.$doValidate(field as unknown as ValidateFieldState<Partial<T>>, updateField);
            },
          }));
        })
        .filter(Boolean);
      effects = effects.concat(validateEffects as Effect<BaseField<unknown>>[]);
    }
    return effects;
  }

  @NonEnumerable
  $getEffects() {
    let effects: Effect<BaseField<unknown>>[] = this.$getSelfEffects();
    effects = effects.concat(this.$getInheritEffects());
    return effects;
  }

  @NonEnumerable
  $firstNotValidEffectState() {
    const effects = this.$getEffects();
    for (const effect of effects) {
      const state = this.$effectState.get(effect);
      if (state && state.valid !== ValidType.Valid) {
        return state;
      }
    }
    return null;
  }

  @NonEnumerable
  $markDirty() {
    this.$dirty = true;
    if (this.$parent) {
      this.$parent.$markDirty();
    }
  }

  @NonEnumerable
  $updateEffectState(effect: Effect<BaseField<unknown>>, newState: EffectState) {
    this.$effectState.set(effect, newState);
  }

  @NonEnumerable
  $waitForExecutorDone(): Promise<void> {
    if (this.$parent) {
      this.$parent.$waitForExecutorDone();
    }
    return Promise.resolve();
  }

  @NonEnumerable
  $mergeState(opts?: Partial<FieldStateOpts<T>>): FieldState<T> {
    return new FieldState({
      value: this.$value,
      disabled: this.$state.$disabled,
      ignore: this.$state.$ignore,
      raw: this.$state.$raw,
      ...opts,
    });
  }

  @NonEnumerable
  protected $pushEffect(effect: Effect<BaseField<T>>) {
    this.$pendingEffects.push(effect);
    this.$pendingEffects = unionBy(this.$pendingEffects, (item) => item.id);
    debug('[Field] this.$pendingEffects.length: ', this.$pendingEffects.length);
  }

  @NonEnumerable
  $pushValidators(trigger?: 'change' | 'blur' | 'any') {
    const validators = this.$validators.filter((validator) => {
      if (validator.trigger === 'any') {
        return true;
      }
      if (trigger) {
        return validator.trigger === trigger;
      }
      return true;
    });
    debug(`[Field] pushValidators type: ${trigger}, length: ${validators.length}`);
    validators.forEach((validator) => {
      const effect = getEffect([this.$self(), validator]) as Effect<BaseField<T>>;
      // 应该根据effect的设置来决定是否重置effect状态
      this.$effectState.set(effect, { valid: ValidType.Unknown, message: '' });
      effect.fields.push(this as BaseField<unknown>);
      this.$pushEffect(effect);
    });
    return Boolean(validators.length);
  }

  @NonEnumerable
  $onChange(raw: any) {
    if (this.$state.$disabled) {
      return;
    }
    if (raw !== this.$raw) {
      this.$pushValidators('change');
      this.$setState(this.$mergeState({ raw }));
      this.$markDirty();
    }
  }

  // 需要校验自身？
  @NonEnumerable
  $onValidate() {
    const pushed = this.$pushValidators();
    if (pushed) {
      this.$setState(this.$mergeState());
      this.$markDirty();
      return this.$waitForExecutorDone().then(() => this.$state);
    }
    return Promise.resolve(this.$state);
  }

  @NonEnumerable
  $onBlur() {
    const pushed = this.$pushValidators('blur');
    if (pushed) {
      this.$setState(
        new FieldState({
          value: this.$value,
          raw: this.$raw,
          disabled: this.$state.$disabled,
          ignore: this.$state.$ignore,
        }),
      );
      this.$markDirty();
    }
  }

  // 是否触发事件
  @NonEnumerable
  $setState(state: FieldState<T>) {
    this.$state = state;
    if (this.$parent) {
      this.$parent.$rebuildState();
    }
  }

  @NonEnumerable
  $eachField(callback: EachFieldCallback<T>) {}

  @NonEnumerable
  $rebuildState() {}
}

type FieldOpts<T> = BaseFieldOpts<T>;

type Extract<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;

export class Field<T> extends BaseField<Extract<T>> {
  constructor(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) {
    super(value, opts);
  }
}
