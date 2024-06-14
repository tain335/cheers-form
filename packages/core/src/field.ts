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

export type EachFieldCallback<T> = (field: BaseField<T>, keyOrIndex?: string | number) => boolean;

type EffectState = {
  valid: ValidType;
  error?: Error;
  message?: string;
};

export type PendingEffect<T extends BaseField<any>> = {
  effect: Effect<T>;
  deps: any[];
};

export function isSameEffectState(older: EffectState, newer: EffectState) {
  return older.valid === newer.valid && older.error === newer.error && older.message === newer.message;
}

export function isDependenciesEqual(newDependencies: any[], oldDependencies: any[]) {
  if (newDependencies === oldDependencies) {
    return true;
  }
  if (newDependencies.length !== oldDependencies.length) {
    return false;
  }
  for (let i = 0; i < newDependencies.length; i++) {
    if (newDependencies[i] !== oldDependencies[i]) {
      return false;
    }
  }
  return true;
}

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
  $pendingEffects: PendingEffect<BaseField<T>>[] = [];

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

  get $pass() {
    return this.$valid === ValidType.Valid;
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

  get $allEffectState(): EffectState[] {
    const effects = this.$getEffects();
    return effects.map((effect) => this.$effectState.get(effect)).filter(Boolean) as EffectState[];
  }

  get $selfPass() {
    return this.$selfValid === ValidType.Valid;
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
  }

  @NonEnumerable
  protected $initEffectsState(valid: ValidType) {
    const effects = this.$getSelfEffects();
    effects.forEach((effect) => {
      effect.deps = effect.watch(this as BaseField<unknown>);
    });
    if (valid !== ValidType.Valid) {
      effects.forEach((effect) => {
        this.$updateEffectState(effect, { valid });
      });
    }
  }

  @NonEnumerable
  protected $self() {
    return this;
  }

  @NonEnumerable
  get $selfValid() {
    const state = this.$firstNotValidEffectState(true);
    if (!state) {
      return ValidType.Valid;
    }
    return state.valid;
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
            force: 0,
            watch: (field) => {
              if (validator.$watch) {
                return validator.$watch(field as unknown as ValidateFieldState<Partial<T>>);
              }
              return [field.$state.$raw];
              // 如果是field是监听$raw 如果是其他监听 $value
              // return this instanceof Field ? [field.$state.$raw] : [field.$state.$value];
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
  $getEffects(self?: boolean) {
    let effects: Effect<BaseField<unknown>>[] = this.$getSelfEffects();
    if (!self) {
      effects = effects.concat(this.$getInheritEffects());
    }
    return effects;
  }

  @NonEnumerable
  $firstNotValidEffectState(self?: boolean) {
    const effects = this.$getEffects(self);
    let firstUnknownState: EffectState | null = null;
    for (const effect of effects) {
      const state = this.$effectState.get(effect);
      if (state && state.valid === ValidType.Invalid) {
        return state;
      }
      if (state && state.valid === ValidType.Unknown) {
        firstUnknownState = state;
      }
    }
    return firstUnknownState;
  }

  @NonEnumerable
  $markDirty() {
    this.$dirty = true;
    if (this.$parent) {
      this.$parent.$markDirty();
    }
  }

  @NonEnumerable
  $updateEffectState(effect: Effect<BaseField<unknown>>, newState: EffectState): boolean {
    const older = this.$effectState.get(effect);
    if (older && isSameEffectState(older, newState)) {
      return false;
    }

    this.$effectState.set(effect, newState);
    return true;
  }

  @NonEnumerable
  $waitForExecutorDone(): Promise<void> {
    if (this.$parent) {
      return this.$parent.$waitForExecutorDone();
    }
    return Promise.resolve();
  }

  @NonEnumerable
  $mergeState(opts?: Partial<FieldStateOpts<T>>): FieldState<T> {
    const valid = this.$selfValid;
    return new FieldState({
      value: valid === ValidType.Valid ? this.$transform(opts?.raw ?? this.$raw) : this.$value,
      disabled: this.$state.$disabled,
      ignore: this.$state.$ignore,
      raw: this.$state.$raw,
      ...opts,
    });
  }

  @NonEnumerable
  protected $pushPendingEffect(effect: PendingEffect<BaseField<T>>) {
    this.$pendingEffects.push(effect);
    this.$pendingEffects = unionBy(this.$pendingEffects, (item) => item.effect.id);
    debug('[Field] this.$pendingEffects.length: ', this.$pendingEffects.length);
  }

  @NonEnumerable
  $pushValidators(trigger: 'change' | 'blur' | 'any' | 'all', force?: boolean) {
    const validators = this.$validators.filter((validator) => {
      if (validator.trigger === 'any' || trigger === 'all') {
        return true;
      }
      if (trigger) {
        return validator.trigger === trigger;
      }
      return true;
    });
    let pushed = 0;
    debug(`[Field] pushValidators type: ${trigger}, length: ${validators.length}`);
    validators.forEach((validator) => {
      const effect = getEffect([this.$self(), validator]) as Effect<BaseField<T>>;
      const newDeps = effect.watch(this);
      if (force || !isDependenciesEqual(newDeps, effect.deps ?? [])) {
        pushed++;
        effect.deps = newDeps;
        effect.fields.push(this as BaseField<unknown>);
        this.$updateEffectState(effect as Effect<BaseField<unknown>>, { valid: ValidType.Unknown, message: '' });
        this.$pushPendingEffect({ effect, deps: effect.deps ?? [] });
      }
    });
    if (pushed) {
      this.$markDirty();
    }
    return Boolean(pushed);
  }

  @NonEnumerable
  $onChange(raw: any) {
    if (this.$state.$disabled) {
      return;
    }
    if (raw !== this.$raw) {
      this.$setState(this.$mergeState({ raw }));
      this.$pushValidators('change');
      this.$rebuildState();
    }
  }

  // 需要校验自身？
  @NonEnumerable
  $onValidate() {
    this.$pushValidators('all', true);
    return this.$waitForExecutorDone().then(() => ({
      $valid: this.$valid,
      $selfValid: this.$selfValid,
      ...this.$state,
    }));
  }

  @NonEnumerable
  $onBlur() {
    this.$pushValidators('blur');
  }

  @NonEnumerable
  $setState(state: FieldState<T>) {
    this.$state = state;
  }

  @NonEnumerable
  $eachField(callback: EachFieldCallback<T>) {}

  @NonEnumerable
  $rebuildState() {
    if (this.$parent) {
      this.$parent.$rebuildState();
    }
  }
}

type FieldOpts<T> = BaseFieldOpts<T>;

type Extract<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;

export class Field<T> extends BaseField<Extract<T>> {
  constructor(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) {
    super(value, opts);
    this.$initEffectsState(opts?.valid ?? ValidType.Valid);
  }
}
