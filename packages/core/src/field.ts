import { flatten, isBoolean, isFunction, unionBy } from 'lodash';
import mitt from 'mitt';
import { NonEnumerable } from './decorator';
import { Effect, EffectType, getEffect } from './effect';
import { FieldState, FieldStateOpts, ValidType } from './field_state';
import { genId } from './id';
import { Validator, ValidatorCompose } from './validator';
import { FieldGroup } from './field_group';
import { FieldArray } from './field_array';
import { debug } from './log';
import { EffectExecutor } from './executor';
import { Extract, ToFields, ToOmitParentFields } from './types';
import { isDependenciesEqual } from './utils';
import { FieldComposeState } from './field_compose';

export const IDENTITY = Symbol('proxy_target_identity');

export type ReceiveCallback<T> = (v: T | undefined, initial: boolean) => any;

export type TransformCallback<T> = (v: any) => T;

export type BaseFieldOpts<T> = {
  // 用于某些字段等待初始化才可以校验，例如异步加载的下拉选项
  lazyToValidate?: boolean | ((field: ToFields<T>) => boolean);
  disabled?: boolean;
  // 用于处理表单某些部分不参与校验，例如分步表单
  ignore?: boolean;
  required?: boolean;
  // 初始化的校验状态，默认Valid
  valid?: ValidType;
  validators?: Validator<T>[];
  // 用于value->raw
  receive?: ReceiveCallback<T>;
  // 用于raw->value, 只有通过自身校验的值才会转换
  transform?: TransformCallback<T>;
};

export type EffectSource = {
  state: EffectState;
  field: BaseField<unknown>;
};

export type EachFieldCallback<T> = (field: BaseField<T>, keyOrIndex?: string | number) => boolean;

export type EffectState = {
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

// TODO 暴露更多的状态和阶段
type EmitterType<T extends BaseField<any>> = {
  update: void;
  // TODO
  // beforeSelfValidate: void;
  // afterSelfValidate: void;
  beforeValidate: Validator<unknown>;
  afterValidate: Validator<unknown>;
};

// field 关注的是$raw, 对外就是$raw + self valid
// field_group 关注的是子field的$raw和它自身校验的结果也就是childState
// field_group 需要一个childState，包含子field $raw的集合和自身校验的集合
// field_group 对外就是$raw + childState + self valid
// reset需要重置modified/manualModified/readyToValidate?
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

  // 要不要往上冒泡修改，如果往上修改如何reset?
  @NonEnumerable
  $selfModified = false;

  @NonEnumerable
  $manualSelfModified = false;

  @NonEnumerable
  $pendingEffects: PendingEffect<BaseField<T>>[] = [];

  @NonEnumerable
  $effectState: WeakMap<any, EffectState> = new WeakMap();

  @NonEnumerable
  $emitter = mitt<EmitterType<BaseField<T>>>();

  @NonEnumerable
  $lazyToValidate: boolean | ((field: any) => boolean) = false;

  @NonEnumerable
  $readyToValidate = false;

  @NonEnumerable
  // @ts-ignore
  $initial: { value: any; valid: ValidType };

  @NonEnumerable
  get $value(): T | undefined {
    return this.$state.$value;
  }

  set $value(v: T | undefined) {
    const newRaw = this.$receive(v, false);
    this.$raw = newRaw;
  }

  @NonEnumerable
  get $raw() {
    return this.$state.$raw;
  }

  set $raw(raw) {
    this.$onChange(raw);
  }

  @NonEnumerable
  get $ignore() {
    return this.$state.$ignore;
  }

  set $ignore(ignore: boolean) {
    this.$setState(this.$mergeState(false, { ignore }));
    this.$pushValidators('change');
    this.$rebuildState(true);
  }

  @NonEnumerable
  get $disabled() {
    return this.$state.$disabled;
  }

  set $disabled(disabled: boolean) {
    this.$setState(this.$mergeState(false, { disabled }));
    this.$pushValidators('change');
    this.$rebuildState(false);
  }

  @NonEnumerable
  get $required() {
    return this.$state.$required;
  }

  set $required(required: boolean) {
    this.$setState(this.$mergeState(false, { required }));
    this.$pushValidators('change');
    this.$rebuildState(false);
  }

  @NonEnumerable
  get $modified() {
    return this.$selfModified;
  }

  @NonEnumerable
  get $manualModified() {
    return this.$manualSelfModified;
  }

  // 获取总的校验状态
  @NonEnumerable
  get $valid(): ValidType {
    const state = this.$firstNotValidEffectState();
    if (state) {
      return state.valid;
    }
    return ValidType.Valid;
  }

  // 获取自身的校验器的校验状体
  @NonEnumerable
  get $selfValid() {
    const state = this.$firstNotValidEffectState(true);
    if (!state) {
      return ValidType.Valid;
    }
    return state.valid;
  }

  @NonEnumerable
  get $pass() {
    return this.$valid === ValidType.Valid;
  }

  @NonEnumerable
  get $selfPass() {
    return this.$selfValid === ValidType.Valid;
  }

  @NonEnumerable
  get $message(): string {
    const state = this.$firstNotValidEffectState();
    if (state) {
      return state.message ?? '';
    }
    return '';
  }

  @NonEnumerable
  get $error(): any {
    const state = this.$firstNotValidEffectState();
    if (state) {
      return state.error;
    }
    return null;
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
      required: opts?.required ?? false,
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
  $getEffectSources(effect: Effect<BaseField<unknown>>): EffectSource[] {
    const state = this.$effectState.get(effect);
    return state ? [{ state, field: this as BaseField<unknown> }] : [];
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
      const validateEffects = flatten(
        this.$validators.map((validator) => {
          if (validator instanceof ValidatorCompose) {
            return validator.$validators.map((subValidator) =>
              getEffect([this.$self(), subValidator], () => subValidator.createEffect(this)),
            );
          }
          return [getEffect([this.$self(), validator], () => validator.createEffect(this))];
        }),
      ).filter(Boolean);
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
      if (!firstUnknownState && state && state.valid === ValidType.Unknown) {
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
  $rootExecutor(): EffectExecutor | null {
    if (this.$parent) {
      return this.$parent.$rootExecutor();
    }
    return null;
  }

  @NonEnumerable
  $waitForExecutorDone(): Promise<void> {
    const executor = this.$rootExecutor();
    if (executor) {
      executor.schedule();
      return new Promise((resolve) => {
        const doneCallback = () => {
          executor.emitter.off('done', doneCallback);
          resolve();
        };
        executor.emitter.on('done', doneCallback);
      });
    }
    return Promise.resolve();
  }

  @NonEnumerable
  $mergeState(rawChanged: boolean, opts?: Partial<FieldStateOpts<T>>): FieldState<T> {
    const valid = this.$selfValid;
    return new FieldState({
      value: valid === ValidType.Valid ? this.$transform(opts?.raw ?? this.$raw) : this.$value,
      disabled: this.$state.$disabled,
      ignore: this.$state.$ignore,
      raw: this.$state.$raw,
      required: this.$state.$required,
      ...opts,
    });
  }

  @NonEnumerable
  protected $pushPendingEffect(effect: PendingEffect<BaseField<T>>) {
    this.$pendingEffects.push(effect);
    this.$pendingEffects = unionBy(this.$pendingEffects, (item) => item.effect.id);
    debug('[Field] this.$pendingEffects.length: ', this.$pendingEffects.length);
  }

  // TODO change effects
  @NonEnumerable
  $pushValidators(trigger: 'change' | 'blur' | 'any' | 'all', force?: boolean) {
    if (this.$lazyToValidate) {
      if (!this.$readyToValidate) {
        if (isBoolean(this.$lazyToValidate)) {
          this.$readyToValidate = true;
        } else if (isFunction(this.$lazyToValidate)) {
          const ready = this.$lazyToValidate(this);
          if (ready) {
            this.$readyToValidate = ready;
          }
        } else {
          throw new Error('not support lazyToValidate type');
        }
        return false;
      }
    }
    const validators = this.$validators.filter((validator) => {
      if (validator.$trigger === 'any' || trigger === 'all') {
        return true;
      }
      if (trigger) {
        return validator.$trigger === trigger;
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
        effect.affectedFields.push(this as BaseField<unknown>);
        // reset effect
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
  $change(raw: any, manual = false) {
    if (raw !== this.$raw) {
      this.$selfModified = true;
      if (manual) {
        this.$manualSelfModified = true;
      }
      this.$setState(this.$mergeState(true, { raw }));
      this.$pushValidators('change');
      this.$rebuildState(true);
    }
  }

  @NonEnumerable
  $onChange(raw: any) {
    if (this.$state.$disabled) {
      return;
    }
    this.$change(raw, true);
  }

  @NonEnumerable
  $onValidate() {
    // 需不需要更新状态？
    this.$setState(this.$mergeState(false));
    this.$pushValidators('all', true);
    this.$rebuildState(false);
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
    Promise.resolve().then(() => {
      this.$emitter.emit('update');
    });
  }

  @NonEnumerable
  $eachField(callback: EachFieldCallback<T>) {}

  @NonEnumerable
  $rebuildState(rawChanged: boolean) {
    if (this.$parent) {
      this.$parent.$rebuildState(rawChanged);
    }
  }

  @NonEnumerable
  $isInProgress() {
    return this.$rootExecutor()?.isFieldInProgress(this as BaseField<unknown>) ?? false;
  }

  @NonEnumerable
  $isValidatorInProgress(validator: Validator<BaseField<unknown>>) {
    const effect = getEffect([this.$self(), validator]);
    if (effect) {
      return this.$rootExecutor()?.isEffectInProgress(effect);
    }
    return false;
  }

  @NonEnumerable
  $onReset() {
    this.$effectState = new WeakMap();
    this.$readyToValidate = false;
    this.$manualSelfModified = false;
    this.$selfModified = false;
  }
}

type FieldOpts<T> = BaseFieldOpts<T>;

export class $Field<T> extends BaseField<Extract<T>> {
  constructor(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) {
    super(value, opts);
    this.$initEffectsState(opts?.valid ?? ValidType.Valid);
    this.$initial = {
      value,
      valid: opts?.valid ?? ValidType.Valid,
    };
  }

  @NonEnumerable
  $onReset(): void {
    super.$onReset();
    this.$initEffectsState(this.$initial.valid);
    this.$setState(this.$mergeState(true, { raw: this.$receive(this.$initial.value, false) }));
    this.$rebuildState(false);
  }
}

function Factory<T>(): new <T>(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) => $Field<Extract<T>> {
  return class {
    constructor(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) {
      return new $Field(value, opts);
    }
  } as any;
}

export type Field<T> = $Field<T>;

export const Field = Factory();
