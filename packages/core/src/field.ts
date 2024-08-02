import { flatten, isUndefined, uniq } from 'lodash';
import { NonEnumerable } from './decorator';
import { Effect, EffectType, getEffect } from './effect';
import { FieldState, FieldStateOpts, ValidType } from './field_state';
import { genId } from './id';
import { Validator, ValidatorCompose } from './validator';
import { FieldGroup } from './field_group';
import { FieldArray } from './field_array';
import { debug } from './log';
import { EffectExecutor } from './executor';
import { Extract, ToFields } from './types';
import { addFlag, isDependenciesEqual, isEmpty } from './utils';
import { HookChain } from './hook_chain';
import { HookSource, getSource, getUnstallHooks, setCurrentField } from './hook_state';

export const IDENTITY = Symbol('proxy_target_identity');

export type ComposeHook<T extends BaseField<any>> = (field: T) => void;

export type ReceiveCallback<T> = (v: T | undefined, initial: boolean) => any;

export type TransformCallback<T> = (v: any) => T;

export type BaseFieldOpts<T> = {
  // 用于某些字段等待初始化才可以校验，例如异步加载的下拉选项
  // lazyToValidate?: boolean | ((field: ToFields<T>) => boolean);
  composeHooks?: (() => void)[];

  changeEffects?: Effect<BaseField<T>>[];

  disabled?: boolean;
  // 用于处理表单某些部分不参与校验，例如分步表单
  ignore?: boolean;
  required?: boolean;
  // 初始化的校验状态，默认Valid
  valid?: ValidType;
  validators?: Validator<T>[];
  // 用于value -> raw
  receive?: ReceiveCallback<T>;
  // 用于raw -> value, 只有通过自身校验的值才会转换
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
  source: HookSource;
  seq: number;
};

export function isSameEffectState(older: EffectState, newer: EffectState) {
  return older.valid === newer.valid && older.error === newer.error && older.message === newer.message;
}

export type ChangeCallback<T extends BaseField<any>> = (field: T) => Promise<void>;

type HookChainType<T> = {
  changed: { raw: any; manual: boolean };
  updateSelfState: FieldState<T>;
  submitEffects: PendingEffect<BaseField<T>>[];
  beforeExecuteEffect: Effect<BaseField<unknown>>;
  afterExecuteEffect: Effect<BaseField<unknown>>;
  updated: FieldState<T>;
  uninstall: BaseField<T>;
};

// field 关注的是$raw, 对外就是$raw + self valid
// field_group 关注的是子field的$raw和它自身校验的结果也就是childState
// field_group 需要一个childState，包含子field $raw的集合和自身校验的集合
// field_group 对外就是$raw + childState + self valid
// reset需要重置modified/manualModified/readyToValidate?
// selfValid 为 true 意味着 raw 跟 value必然是同步的，但是selfValid 为 false也不意味着raw 跟 valu不同步，可以updateField的时候同时更新value
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
  $flag = 0;

  // 要不要往上冒泡修改，如果往上修改如何reset?
  @NonEnumerable
  $selfModified = false;

  @NonEnumerable
  $manualSelfModified = false;

  @NonEnumerable
  $pendingEffects: PendingEffect<BaseField<T>>[] = [];

  @NonEnumerable
  $changeEffects: Effect<BaseField<T>>[] = [];

  @NonEnumerable
  $effectState: WeakMap<any, EffectState> = new WeakMap();

  @NonEnumerable
  $holdEffectState: EffectState | undefined;

  @NonEnumerable
  $hookChain = new HookChain<HookChainType<T>>();

  @NonEnumerable
  $statedUpdateScheduled = false;

  @NonEnumerable
  // @ts-ignore
  $initial: { value: any; valid: ValidType };

  @NonEnumerable
  $meta: Record<string, any> = {};

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
    this.$hookChain.source({ emitter: 'ignore', field: this as BaseField<unknown> });
    this.$setState(this.$mergeState(false, { ignore }), () => {
      this.$rebuildState(true);
      this.$pushValidators('change');
    });
  }

  @NonEnumerable
  get $disabled() {
    return this.$state.$disabled;
  }

  set $disabled(disabled: boolean) {
    this.$hookChain.source({ emitter: 'disabled', field: this as BaseField<unknown> });
    this.$setState(this.$mergeState(false, { disabled }), () => {
      this.$rebuildState(false);
      this.$pushValidators('change');
    });
  }

  @NonEnumerable
  get $required() {
    return this.$state.$required;
  }

  set $required(required: boolean) {
    this.$hookChain.source({ emitter: 'required', field: this as BaseField<unknown> });
    this.$setState(this.$mergeState(false, { required }), () => {
      this.$pushValidators('change');
      this.$rebuildState(false);
    });
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

  // 如果transform产生新的object value
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
    this.$changeEffects = opts?.changeEffects ?? [];
    if (opts?.composeHooks) {
      for (const hook of opts.composeHooks) {
        this.composeHook(hook);
      }
    }
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
              getEffect([this.$self(), subValidator], () => subValidator.createEffect()),
            );
          }
          return [getEffect([this.$self(), validator], () => validator.createEffect())];
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
    if (this.$holdEffectState && this.$holdEffectState.valid !== ValidType.Valid) {
      return this.$holdEffectState;
    }
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
  $markFlag(flag: number) {
    this.$flag = addFlag(this.$flag, flag);
    if (this.$parent) {
      this.$parent.$markFlag(flag);
    }
  }

  @NonEnumerable
  $scheduleStateUpdate() {
    if (!this.$statedUpdateScheduled) {
      this.$statedUpdateScheduled = true;
      Promise.resolve().then(() => {
        this.$statedUpdateScheduled = false;
        this.$hookChain.call('updated', this.$state, () => {});
      });
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
    const selfValid = this.$selfValid;
    return new FieldState({
      // 不应该每次都transform新的值
      value: selfValid === ValidType.Valid ? this.$transform(this.$raw) : this.$value,
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
    this.$pendingEffects = uniq(this.$pendingEffects);
    debug('[Field] this.$pendingEffects.length: ', this.$pendingEffects.length);
  }

  @NonEnumerable
  protected $computeInitialValid(value: any, required?: boolean, valid?: ValidType) {
    if (!isUndefined(valid)) {
      return valid;
    }
    if (required) {
      if (isEmpty(value)) {
        return ValidType.Unknown;
      }
      return ValidType.Invalid;
    }
    return ValidType.Valid;
  }

  @NonEnumerable
  composeHook(hook: ComposeHook<BaseField<T>>) {
    setCurrentField(this as BaseField<unknown>);
    hook(this);
    const uninstalls = getUnstallHooks();
    setCurrentField(undefined);
    return () => {
      this.$hookChain.call('uninstall', this as BaseField<T>, () => {
        for (const uninstall of uninstalls) {
          uninstall();
        }
      });
    };
  }

  @NonEnumerable
  $pushValidators(trigger: 'change' | 'blur' | 'any' | 'all', force?: boolean) {
    let newFlag = 0;
    const validators = this.$validators.filter((validator) => {
      if (validator.$trigger === 'any' || trigger === 'all') {
        return true;
      }
      if (trigger) {
        return validator.$trigger === trigger;
      }
      return true;
    });
    debug(`[Field] pushValidators type: ${trigger}, length: ${validators.length}`);
    const pendingEffects: PendingEffect<BaseField<T>>[] = [];
    for (const validator of validators) {
      const effect = getEffect([this.$self(), validator]) as Effect<BaseField<T>>;
      const newDeps = effect.watch(this);
      if (force || !isDependenciesEqual(newDeps, effect.deps ?? [])) {
        effect.seq++;
        effect.owner = this as BaseField<unknown>;
        effect.deps = newDeps;
        effect.affectedFields.push(this as BaseField<unknown>);
        pendingEffects.push({ effect, seq: effect.seq, source: getSource() as HookSource });
        newFlag = addFlag(newFlag, EffectType.Async);
      }
    }
    if (trigger === 'change') {
      for (const effect of this.$changeEffects) {
        const newDeps = effect.watch(this);
        if (!isDependenciesEqual(newDeps, effect.deps ?? [])) {
          effect.seq++;
          effect.owner = this as BaseField<unknown>;
          effect.deps = newDeps;
          effect.affectedFields.push(this as BaseField<unknown>);
          pendingEffects.push({ effect, seq: effect.seq, source: getSource() as HookSource });
          newFlag = addFlag(newFlag, EffectType.Sync);
        }
      }
    }
    this.$hookChain.call('submitEffects', pendingEffects, (pendingEffects) => {
      for (const pending of pendingEffects) {
        this.$updateEffectState(pending.effect as Effect<BaseField<unknown>>, {
          valid: ValidType.Unknown,
          message: '',
        });
        this.$pushPendingEffect(pending);
      }
      if (pendingEffects.length) {
        this.$markFlag(newFlag);
      }
    });
  }

  @NonEnumerable
  $change(raw: any, manual = false) {
    if (raw !== this.$raw) {
      this.$hookChain
        .source({ emitter: 'change', field: this as BaseField<unknown> })
        .call('changed', { raw, manual }, ({ raw, manual }) => {
          this.$selfModified = true;
          if (manual) {
            this.$manualSelfModified = true;
          }
          this.$setState(this.$mergeState(true, { raw }), () => {
            this.$rebuildState(true);
            this.$pushValidators('change');
          });
        });
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
    this.$hookChain.source({ emitter: 'validate', field: this as BaseField<unknown> });
    this.$setState(this.$mergeState(false), (state) => {
      this.$rebuildState(false);
      this.$pushValidators('all', true);
    });
    return this.$waitForExecutorDone().then(() => ({
      $valid: this.$valid,
      $selfValid: this.$selfValid,
      ...this.$state,
    }));
  }

  @NonEnumerable
  $onBlur() {
    this.$hookChain.source({ emitter: 'blur', field: this as BaseField<unknown> });
    this.$pushValidators('blur');
  }

  @NonEnumerable
  $setState(state: FieldState<T>, action?: (newState: FieldState<T>) => void) {
    this.$hookChain.call('updateSelfState', state, () => {
      this.$state = state;
      this.$scheduleStateUpdate();
      action?.(state);
    });
  }

  @NonEnumerable
  $rebuildState(rawChanged: boolean) {
    if (this.$parent) {
      this.$parent.$rebuildState(rawChanged);
    }
  }

  @NonEnumerable
  $isInProgress() {
    if (this.$pendingEffects.length) {
      return true;
    }
    const inProgress = this.$rootExecutor()?.isFieldInProgress(this as BaseField<unknown>) ?? false;
    if (!inProgress) {
      for (const effect of this.$getSelfEffects()) {
        if (this.$rootExecutor()?.isEffectInProgress(effect)) {
          return true;
        }
      }
    }
    return false;
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
  $onReset(rebuildParent = true) {
    this.$clearState();
    this.$meta = {};
    this.$manualSelfModified = false;
    this.$selfModified = false;
  }

  // 清除校验状态
  @NonEnumerable
  $clearState() {
    this.$effectState = new WeakMap();
    this.$holdEffectState = undefined;
    this.$rebuildState(false);
    this.$scheduleStateUpdate();
  }

  // 设置数据
  @NonEnumerable
  $set(name: string, value: any) {
    this.$meta[name] = value;
  }

  @NonEnumerable
  $del(name: string) {
    this.$meta[name] = undefined;
  }

  // 设置状态
  @NonEnumerable
  $holdState(state: EffectState) {
    this.$holdEffectState = state;
    this.$rebuildState(false);
    this.$scheduleStateUpdate();
  }

  @NonEnumerable
  $unholdState() {
    this.$holdEffectState = undefined;
    this.$rebuildState(false);
    this.$scheduleStateUpdate();
  }
}

type FieldOpts<T> = BaseFieldOpts<T>;

export class $Field<T> extends BaseField<Extract<T>> {
  constructor(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) {
    super(value, opts);
    const initialValid = this.$computeInitialValid(value, opts?.required, opts?.valid);
    this.$initEffectsState(initialValid);
    this.$initial = {
      value,
      valid: initialValid,
    };
  }

  @NonEnumerable
  $onReset(rebuildParent = true): void {
    super.$onReset();
    this.$initEffectsState(this.$initial.valid);
    if (!rebuildParent) {
      this.$hookChain.source({ emitter: 'reset', field: this as BaseField<unknown> });
    }
    this.$setState(this.$mergeState(true, { raw: this.$receive(this.$initial.value, false) }), () => {
      if (rebuildParent) {
        this.$rebuildState(false);
      }
    });
  }
}

export type Field<T> = $Field<T>;

function Factory<T>(): new <T>(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) => Field<Extract<T>> {
  return class {
    constructor(value: Extract<T> | undefined, opts?: FieldOpts<Extract<T>>) {
      return new $Field(value, opts);
    }
  } as any;
}

export const Field = Factory();
