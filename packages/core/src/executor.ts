import { remove, uniqBy } from 'lodash';
import { FieldStateOpts, ValidType } from './field_state';
import { BaseField, PendingEffect, isDependenciesEqual } from './field';
import { Effect, EffectType } from './effect';
import { debug } from './log';

export type UpdateFieldStateCallback = (
  targetField: BaseField<any>,
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

type DoneListener = () => void;

type RemoveDoneCallback = () => void;

type EffectTask = {
  field: BaseField<unknown>;
  pendingsEffects: PendingEffect<BaseField<unknown>>[];
};

export class EffectExecutor {
  scheduled = false;

  inProgressEffectCount = 0;

  queue: BaseField<unknown>[] = [];

  listeners: DoneListener[] = [];

  onceDone(listener: DoneListener) {
    const del = this.onDone(() => {
      listener();
      del();
    });
  }

  onDone(listener: DoneListener): RemoveDoneCallback {
    this.listeners.push(listener);
    return () => {
      remove(this.listeners, (item) => item === listener);
    };
  }

  offDone(listener: DoneListener) {
    remove(this.listeners, listener);
  }

  private nextTick() {
    ('requestIdleCallback' in globalThis ? requestIdleCallback : requestIdleCallbackPolyfill)(
      () => {
        this.scheduled = false;
        debug(`[Executor] start, queue length: ${this.queue.length}`);
        if (this.queue.length) {
          const changeTasks: EffectTask[] = [];
          const validateTasks: EffectTask[] = [];
          const fields = this.queue.slice();
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
              // debug(field.$value);
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

  isDone() {
    return this.inProgressEffectCount === 0 && this.queue.length === 0 && !this.scheduled;
  }

  shouldDone() {
    remove(this.queue, (field) => {
      if (field.$pendingEffects.length === 0) {
        field.$dirty = false;
        return true;
      }
      return false;
    });

    // 可以认为已经完成校验
    if (this.isDone()) {
      debug('[Executor] done');
      this.listeners.slice().forEach((listener) => {
        listener();
      });
    }
  }

  private startEffect(effect: Effect<BaseField<unknown>>, field: BaseField<unknown>, deps: any[]) {
    debug('[Executor] start effect');
    this.inProgressEffectCount++;
    debug('[Executor] effect fields length', effect.fields.length);
    const beforeApplyFields = uniqBy(effect.fields, (item) => item.$id);
    const afterApplyFields: BaseField<unknown>[] = [];
    effect.fields = [];
    const updateState: UpdateFieldStateCallback = (targetField, newState) => {
      if (isDependenciesEqual(effect.watch(field), deps)) {
        const opts: FieldStateOpts<unknown> = {
          value: targetField.$state.$value,
          raw: targetField.$state.$raw,
          disabled: targetField.$state.$disabled,
          ignore: targetField.$state.$ignore,
        };
        let effectUpdated = false;
        if ('valid' in newState) {
          afterApplyFields.push(targetField);
          effectUpdated = targetField.$updateEffectState(effect, {
            valid: newState.valid as ValidType,
            message: newState.message ?? '',
            error: newState.error,
          });
        }

        if (effectUpdated) {
          const newFieldState = targetField.$mergeState({
            ...opts,
            ...newState,
          });
          if (!targetField.$state.isEqual(newFieldState)) {
            // Update Field
            targetField.$setState(newFieldState);
            targetField.$pushValidators('change');
            if (targetField.$parent) {
              targetField.$parent.$rebuildState();
            }
          }
        }
        return true;
      }
      return false;
    };
    // TODO 应该根据effect的设置来决定是否重置effect状态
    effect.apply(field, updateState).finally(() => {
      this.completeEffect(
        effect,
        beforeApplyFields,
        uniqBy(afterApplyFields, (item) => item.$id),
      );
    });
  }

  private completeEffect(
    effect: Effect<BaseField<unknown>>,
    beforeApplyFields: BaseField<unknown>[],
    afterApplyFields: BaseField<unknown>[],
  ) {
    this.inProgressEffectCount--;
    debug('[Executor] complete effect');
    afterApplyFields.forEach((field) => {
      remove(beforeApplyFields, field);
    });

    // 更新关联的field
    effect.fields = afterApplyFields.slice();

    beforeApplyFields.forEach((field) => {
      const updated = field.$updateEffectState(effect, { valid: ValidType.Valid });
      if (updated) {
        // 因为校验不会改变值，所以保持原样
        field.$setState(field.$mergeState({}));
        field.$pushValidators('change');
        if (field.$parent) {
          field.$parent.$rebuildState();
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

  schedule(dirtyFields: BaseField<unknown>[]) {
    this.queue.push(...dirtyFields);
    this.queue = uniqBy(this.queue, (field) => field.$id);

    if (!this.scheduled) {
      this.scheduled = true;
      this.nextTick();
    }
  }
}
