import { remove, uniqBy } from 'lodash';
import { FieldState, FieldStateOpts, ValidType } from './field_state';
import { BaseField, Field } from './field';
import { Effect, EffectType } from './effect';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';
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
  effects: Effect<BaseField<unknown>>[];
};

function isDependenciesEqual(newDependencies: any[], oldDependencies: any[]) {
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
          const fields = this.queue.filter((field) => {
            if (field instanceof Field) {
              return true;
            }
            if (
              (field as FieldArray<unknown[]> | FieldGroup<object>).$state.$childrenState.$valid === ValidType.Valid
            ) {
              return true;
            }
            return false;
          });
          debug(`[Executor] fields length: ${fields.length}`);
          fields.forEach((field) => {
            const effects = remove(field.$pendingEffects, (effect) => {
              return effect.type === EffectType.Change;
            });
            if (effects.length) {
              const task: EffectTask = {
                field,
                effects,
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
              const effects = remove(field.$pendingEffects, (field) => {
                return field.type === EffectType.Validate;
              });
              if (effects.length) {
                const task: EffectTask = {
                  field,
                  effects,
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
        if ('valid' in newState) {
          afterApplyFields.push(targetField);
          targetField.$updateEffectState(effect, {
            valid: newState.valid as ValidType,
            message: newState.message ?? '',
            error: newState.error,
          });
        }
        // Update Field
        targetField.$setState(
          targetField.$mergeState({
            ...opts,
            ...newState,
          }),
        );
        targetField.$pushValidators('any');
        // Mark Dirty
        targetField.$markDirty();
        return true;
      }
      return false;
    };
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
    remove(this.queue, (field) => {
      if (field.$pendingEffects.length === 0) {
        field.$dirty = false;
        return true;
      }
      return false;
    });

    debug('[Executor] complete effect');
    afterApplyFields.forEach((field) => {
      remove(beforeApplyFields, field);
    });

    beforeApplyFields.forEach((field) => {
      field.$updateEffectState(effect, { valid: ValidType.Valid });

      field.$setState(field.$mergeState());
      field.$pushValidators('any');
      if (field.$pendingEffects.length) {
        field.$markDirty();
      }
    });

    this.shouldDone();
  }

  private execute(tasks: EffectTask[]) {
    for (const task of tasks) {
      for (const effect of task.effects) {
        const newDeps = effect.watch(task.field);
        if (!effect.deps || !isDependenciesEqual(newDeps, effect.deps ?? [])) {
          this.startEffect(effect, task.field, newDeps);
        }
        effect.deps = newDeps;
      }
    }
  }

  schedule(dirtyFields: BaseField<unknown>[]) {
    if (dirtyFields.length) {
      this.queue.push(...dirtyFields);
      this.queue = uniqBy(dirtyFields, (field) => field.$id);

      if (!this.scheduled) {
        this.scheduled = true;
        this.nextTick();
      }
    }
  }
}
