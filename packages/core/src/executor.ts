import { flatten, isString, remove, uniqBy } from 'lodash';
import mitt from 'mitt';
import { FieldStateOpts, ValidType } from './field_state';
import { BaseField, PendingEffect } from './field';
import { Effect, EffectType } from './effect';
import { debug } from './log';
import { OmitParent } from './types';
import { HookSource } from './hook_state';

export type UpdateFieldStateCallback = (
  targetField: OmitParent<BaseField<any>>,
  newState:
    | Partial<
        Omit<FieldStateOpts<BaseField<unknown>>, 'raw' | 'value'> & {
          valid?: ValidType;
          error?: any;
          message?: string;
        }
      >
    | string,
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

  inProgressEffects: WeakMap<Effect<BaseField<unknown>>, number> = new WeakMap();

  schduledResolvers: ((flag: number) => BaseField<unknown>[])[] = [];

  emitter = mitt<{ done: void }>();

  isDone() {
    return this.inProgressEffectCount === 0 && this.inProgressFields.size === 0 && !this.scheduled;
  }

  shouldDone() {
    Array.from(this.inProgressFields.values()).forEach((field) => {
      if (field.$pendingEffects.length === 0) {
        field.$flag = 0;
        this.inProgressFields.delete(field);
      }
    });
    // 可以认为已经完成校验
    if (this.isDone()) {
      debug('[Executor] done');
      this.emitter.emit('done');
    } else if (!this.scheduled) {
      // 没有完成则继续触发下一轮
      this.scheduleNextTick();
    }
  }

  isEffectInProgress(effect: Effect<BaseField<unknown>>) {
    return this.inProgressEffects.get(effect);
  }

  isFieldInProgress(field: BaseField<unknown>) {
    return this.inProgressFields.has(field);
  }

  private executeWork(effectType: EffectType) {
    const fields: BaseField<unknown>[] = [];
    fields.push(...flatten(this.schduledResolvers.map((resolver) => resolver(effectType))));

    debug(`[Executor] start, fields length: ${fields.length}`);
    if (fields.length) {
      const tasks: EffectTask[] = [];
      fields.forEach((field) => {
        this.inProgressFields.add(field);
        debug(`[Executor] field $pendingEffects length: ${field.$pendingEffects.length}`);
        const effects = remove(field.$pendingEffects, (pending) => {
          return pending.effect.type === effectType;
        });
        if (effects.length) {
          const task: EffectTask = {
            field,
            pendingsEffects: effects.filter((pending) => pending.effect.seq === pending.seq),
          };
          tasks.push(task);
        }
      });
      debug(`[Executor] tasks length: ${tasks.length}`);
      this.executeTasks(tasks);
      // }
    } else {
      Promise.resolve().then(() => this.shouldDone());
    }
  }

  private scheduleNextTick() {
    ('requestIdleCallback' in globalThis ? requestIdleCallback : requestIdleCallbackPolyfill)(
      () => {
        this.scheduled = false;
        this.executeWork(EffectType.Async);
      },
      {
        timeout: 72,
      },
    );
  }

  private markEffect(effect: Effect<BaseField<unknown>>) {
    if (!this.inProgressEffects.has(effect)) {
      this.inProgressEffects.set(effect, 1);
    } else {
      const count = this.inProgressEffects.get(effect) as number;
      this.inProgressEffects.set(effect, count + 1);
    }
  }

  private unmarkEffect(effect: Effect<BaseField<unknown>>) {
    const count = this.inProgressEffects.get(effect) as number;
    this.inProgressEffects.set(effect, count - 1);
    if (count - 1 === 0) {
      effect.owner?.$scheduleStateUpdate();
    }
  }

  private startEffect(effect: Effect<BaseField<unknown>>, field: BaseField<unknown>, seq: number, source: HookSource) {
    const beforeApplyFields = uniqBy(effect.affectedFields, (item) => item);
    const afterApplyFields: BaseField<unknown>[] = [];
    // 应该支持value的更新
    const updateField: UpdateFieldStateCallback = (targetField, newState) => {
      if (effect.seq === seq) {
        const opts: FieldStateOpts<unknown> = {
          value: targetField.$state.$value,
          raw: targetField.$state.$raw,
          disabled: targetField.$state.$disabled,
          ignore: targetField.$state.$ignore,
          required: targetField.$state.$required,
        };
        let effectUpdated = false;
        if (isString(newState)) {
          newState = { valid: ValidType.Invalid, message: newState };
        }
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
            targetField.$hookChain.source(source);
            // Update Field
            targetField.$setState(newFieldState, () => {
              targetField.$pushValidators('change');
            });
          } else {
            // 触发一次更新
            targetField.$scheduleStateUpdate();
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
    effect.owner?.$hookChain.source(source);
    effect.owner?.$hookChain.call('beforeExecuteEffect', effect, (effect) => {
      debug('[Executor] start effect');
      this.inProgressEffectCount++;
      this.markEffect(effect);
      debug('[Executor] effect fields length', effect.affectedFields.length);
      // TODO 应该根据effect的设置来决定是否重置effect状态
      effect.apply(field, updateField).finally(() => {
        this.completeEffect(
          effect,
          beforeApplyFields,
          uniqBy(afterApplyFields, (item) => item),
          seq,
          source,
        );
      });
    });
  }

  private completeEffect(
    effect: Effect<BaseField<unknown>>,
    beforeApplyFields: BaseField<unknown>[],
    afterApplyFields: BaseField<unknown>[],
    seq: number,
    source: HookSource,
  ) {
    this.inProgressEffectCount--;
    this.unmarkEffect(effect);
    debug('[Executor] complete effect');
    if (effect.seq === seq) {
      afterApplyFields.forEach((field) => {
        remove(beforeApplyFields, field);
      });
      // 更新关联的field
      effect.affectedFields = afterApplyFields.slice();
      beforeApplyFields.forEach((field) => {
        const updated = field.$updateEffectState(effect, { valid: ValidType.Valid });
        if (updated) {
          // 因为校验不会改变值，所以保持原样
          field.$setState(field.$mergeState(false), () => {
            // 需要触发一次change事件？触发any
            // field.$pushValidators('change');
            if (field.$parent) {
              // 因为field group是监听childrend的校验状态
              field.$parent.$rebuildState(true);
            }
          });
        }
      });
    }
    effect.owner?.$hookChain.source(source);
    effect.owner?.$hookChain.call('afterExecuteEffect', effect, () => {});
    this.shouldDone();
  }

  private executeTasks(tasks: EffectTask[]) {
    let executed = false;
    for (const task of tasks) {
      for (const pending of task.pendingsEffects) {
        executed = true;
        this.startEffect(pending.effect, task.field, pending.seq, pending.source);
      }
    }
    if (!executed) {
      // 因为可能出现没有可执行的effect
      Promise.resolve().then(() => this.shouldDone());
    }
  }

  registerResolver(dirtyFieldsResolver: (flag: number) => BaseField<unknown>[]) {
    this.schduledResolvers.push(dirtyFieldsResolver);
  }

  schedule() {
    if (!this.scheduled) {
      this.scheduled = true;
      this.scheduleNextTick();
    }
  }

  exec() {
    this.executeWork(EffectType.Sync);
  }
}
