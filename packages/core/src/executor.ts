import { flatten, includes, remove, uniqBy } from 'lodash';
import mitt from 'mitt';
import { FieldStateOpts, ValidType } from './field_state';
import { BaseField, PendingEffect } from './field';
import { Effect, EffectType } from './effect';
import { debug } from './log';
import { isDependenciesEqual } from './utils';
import { OmitParent } from './types';

export type UpdateFieldStateCallback = (
  targetField: OmitParent<BaseField<any>>,
  newState: Partial<
    Omit<FieldStateOpts<BaseField<unknown>>, 'raw' | 'value'> & {
      valid?: ValidType;
      error?: any;
      message?: string;
    }
  >,
) => boolean;

function requestIdleCallbackPolyfill(
  callback: Parameters<typeof requestIdleCallback>[0],
  opts?: Parameters<typeof requestIdleCallback>[1],
) {
  return setTimeout(callback, 64);
}

type EffectTask = {
  field: BaseField<unknown>;
  pendingsEffects: PendingEffect<BaseField<unknown>>[];
};

// 从单个处理批次上，每次都会把所有dirty field的pendingEffects清理完
// 每个effect处理的最后都检查field的pendingEffects为空才移除
// 为什么需要一个executor就是因为effect需要分成两个阶段，change和vadliate
// change的阶段用于处理字段的联动，这个阶段会影响值；而validate仅用于校验一般不会出现值的改变
// 为什么需要从头遍历form，就是因为一般需要保持校验的顺序，子字段的校验先执行，父字段的校验后执行；
// 但是这里会出现子字段如果是异步，父字段校验是同步就会出现问题，或者加入等待children校验成功才进行
export class EffectExecutor {
  scheduled = false;

  inProgressEffectCount = 0;

  inProgressFields: Set<BaseField<unknown>> = new Set();

  effects: WeakMap<Effect<BaseField<unknown>>, number> = new WeakMap();

  schduledResolvers: (() => BaseField<unknown>[])[] = [];

  emitter = mitt<{ done: void }>();

  isDone() {
    return this.inProgressEffectCount === 0 && this.inProgressFields.size === 0 && !this.scheduled;
  }

  shouldDone() {
    Array.from(this.inProgressFields.values()).forEach((field) => {
      if (field.$pendingEffects.length === 0) {
        field.$dirty = false;
        this.inProgressFields.delete(field);
      }
    });
    // 可以认为已经完成校验
    if (this.isDone()) {
      debug('[Executor] done');
      this.emitter.emit('done');
    } else {
      // 没有完成则继续触发下一轮
      this.scheduleNextTick();
    }
  }

  isEffectInProgress(effect: Effect<BaseField<unknown>>) {
    return this.effects.get(effect);
  }

  isFieldInProgress(field: BaseField<unknown>) {
    return this.inProgressFields.has(field);
  }

  private scheduleNextTick() {
    ('requestIdleCallback' in globalThis ? requestIdleCallback : requestIdleCallbackPolyfill)(
      () => {
        const fields: BaseField<unknown>[] = [];
        fields.push(...flatten(this.schduledResolvers.map((resolver) => resolver())));
        this.scheduled = false;

        debug(`[Executor] start, fields length: ${fields.length}`);
        if (fields.length) {
          const changeTasks: EffectTask[] = [];
          const validateTasks: EffectTask[] = [];
          debug(`[Executor] fields length: ${fields.length}`);
          fields.forEach((field) => {
            const effects = remove(field.$pendingEffects, (effect) => {
              return effect.effect.type === EffectType.Change;
            });
            if (effects.length) {
              const task: EffectTask = {
                field,
                pendingsEffects: effects,
              };
              changeTasks.push(task);
            }
          });
          debug(`[Executor] changeTasks length: ${changeTasks.length}`);
          if (changeTasks.length) {
            this.execute(changeTasks);
          } else {
            fields.forEach((field) => {
              debug(`[Executor] field $pendingEffects length: ${field.$pendingEffects.length}`);
              const effects = remove(field.$pendingEffects, (effect) => {
                return effect.effect.type === EffectType.Validate;
              });
              if (effects.length) {
                const task: EffectTask = {
                  field,
                  pendingsEffects: effects,
                };
                validateTasks.push(task);
              }
            });
            debug(`[Executor] validateTasks length: ${validateTasks.length}`);
            this.execute(validateTasks);
          }
        } else {
          Promise.resolve().then(() => this.shouldDone());
        }
      },
      {
        timeout: 72,
      },
    );
  }

  private markEffect(effect: Effect<BaseField<unknown>>) {
    if (!this.effects.has(effect)) {
      this.effects.set(effect, 1);
    } else {
      const count = this.effects.get(effect) as number;
      this.effects.set(effect, count + 1);
    }
  }

  private unmarkEffect(effect: Effect<BaseField<unknown>>) {
    const count = this.effects.get(effect) as number;
    this.effects.set(effect, count - 1);
  }

  private startEffect(effect: Effect<BaseField<unknown>>, field: BaseField<unknown>, deps: any[]) {
    debug('[Executor] start effect');
    this.inProgressEffectCount++;
    this.markEffect(effect);
    debug('[Executor] effect fields length', effect.affectedFields.length);
    const beforeApplyFields = uniqBy(effect.affectedFields, (item) => item);
    const afterApplyFields: BaseField<unknown>[] = [];
    effect.affectedFields = [];
    const updateField: UpdateFieldStateCallback = (targetField, newState) => {
      if (isDependenciesEqual(effect.watch(field), deps)) {
        const opts: FieldStateOpts<unknown> = {
          value: targetField.$state.$value,
          raw: targetField.$state.$raw,
          disabled: targetField.$state.$disabled,
          ignore: targetField.$state.$ignore,
          required: targetField.$state.$required,
        };
        let effectUpdated = false;
        if ('valid' in newState) {
          afterApplyFields.push(targetField as BaseField<any>);
          effectUpdated = targetField.$updateEffectState(effect, {
            valid: newState.valid as ValidType,
            message: newState.message ?? '',
            error: newState.error,
          });
        }

        if (effectUpdated) {
          const newFieldState = targetField.$mergeState(false, {
            ...opts,
            ...newState,
          });
          if (!targetField.$state.isEqual(newFieldState)) {
            // Update Field
            targetField.$setState(newFieldState);
            targetField.$pushValidators('change');
          }
          // effect update 也要更新parent state
          if ((targetField as BaseField<any>).$parent) {
            (targetField as BaseField<any>).$parent?.$rebuildState(false);
          }
        }
        return true;
      }
      return false;
    };
    effect.beforeApply?.();
    // TODO 应该根据effect的设置来决定是否重置effect状态
    effect.apply(field, updateField).finally(() => {
      this.completeEffect(
        effect,
        beforeApplyFields,
        uniqBy(afterApplyFields, (item) => item),
      );
      effect.afterApply?.();
    });
  }

  private completeEffect(
    effect: Effect<BaseField<unknown>>,
    beforeApplyFields: BaseField<unknown>[],
    afterApplyFields: BaseField<unknown>[],
  ) {
    this.inProgressEffectCount--;
    this.unmarkEffect(effect);
    debug('[Executor] complete effect');
    afterApplyFields.forEach((field) => {
      remove(beforeApplyFields, field);
    });

    // 更新关联的field
    effect.affectedFields = afterApplyFields.slice();

    beforeApplyFields.forEach((field) => {
      const updated = field.$updateEffectState(effect, { valid: ValidType.Valid });
      if (updated) {
        // 因为校验不会改变值，所以保持原样
        field.$setState(field.$mergeState(false));
        field.$pushValidators('change');
        if (field.$parent) {
          field.$parent.$rebuildState(false);
        }
      }
    });

    this.shouldDone();
  }

  private execute(tasks: EffectTask[]) {
    for (const task of tasks) {
      for (const pending of task.pendingsEffects) {
        this.startEffect(pending.effect, task.field, pending.deps);
      }
    }
    // 因为可能出现没有可执行的effect
    Promise.resolve().then(() => this.shouldDone());
  }

  registerResolver(dirtyFieldsResolver: () => BaseField<unknown>[]) {
    this.schduledResolvers.push(dirtyFieldsResolver);
  }

  schedule() {
    if (!this.scheduled) {
      this.scheduled = true;
      this.scheduleNextTick();
    }
  }
}
