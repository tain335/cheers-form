import { Effect, EffectType } from './effect';
import { UpdateFieldStateCallback } from './executor';
import { $Field, BaseField } from './field';
import { FieldComposeState } from './field_compose';
import { genId } from './id';
import { ToOmitParentFields } from './types';

export type ValidatorTriggerType = 'blur' | 'change' | 'manual' | 'any';

interface ValidatorOptions<T> {
  debounce?: number;
  validate: (field: ToOmitParentFields<Partial<T>>, updateState: UpdateFieldStateCallback) => Promise<void>;
  watch?: (field: ToOmitParentFields<Partial<T>>) => any[];
  trigger?: ValidatorTriggerType;
}

class DebounceHandler {
  private timer = -1;

  private pending: Promise<void> | undefined;

  // @ts-ignore
  private resolveFunc: (value: void | PromiseLike<void>) => void;

  // @ts-ignore
  private rejectFunc: (value: void | PromiseLike<void>) => void;

  constructor(private handler: () => Promise<void>, private interval: number) {}

  async wait(): Promise<void> {
    if (this.pending) {
      return this.pending;
    }
    this.pending = new Promise((resolve, reject) => {
      this.resolveFunc = resolve;
      this.rejectFunc = reject;
      this.reset();
    });
    return this.pending;
  }

  reset(handler?: () => Promise<void>) {
    if (handler) {
      this.handler = handler;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.handler()
        .then(() => {
          this.timer = -1;
          this.pending = undefined;
          this.resolveFunc();
        })
        .catch((err) => {
          this.timer = -1;
          this.pending = undefined;
          this.rejectFunc(err);
        });
    }, this.interval);
  }
}

const debounceMap = new WeakMap<Effect<BaseField<unknown>>, DebounceHandler | undefined>();

export class Validator<T> {
  $id: number = genId();

  $trigger: ValidatorTriggerType = 'change';

  private $$validateCallback: ValidatorOptions<T>['validate'];

  $watch?: ValidatorOptions<T>['watch'] = () => [];

  $debounce: number | undefined = 0;

  constructor({ validate, watch, trigger, debounce }: ValidatorOptions<T>) {
    this.$debounce = debounce;
    this.$$validateCallback = validate;
    this.$watch = watch;
    this.$trigger = trigger ?? 'change';
  }

  async $doValidate(field: ToOmitParentFields<Partial<T>>, updateState: UpdateFieldStateCallback) {
    await this.$$validateCallback(field, updateState);
  }

  createEffect<S extends BaseField<T>>(field: S): Effect<BaseField<S>> {
    const validator = this;
    return {
      id: `${field.$id}-${this.$id}`,
      seq: 0,
      type: EffectType.Validate,
      affectedFields: [],
      watch: (field) => {
        if (this.$watch) {
          return this.$watch(field as unknown as ToOmitParentFields<Partial<T>>);
        }
        return field instanceof $Field ? [field.$state.$raw] : [(field.$state as FieldComposeState<T>).$childrenState];
      },
      beforeApply: () => {
        field.$emitter.emit('beforeValidate', this as Validator<unknown>);
      },
      afterApply: () => {
        field.$emitter.emit('afterValidate', this as Validator<unknown>);
      },
      async apply(field, updateField) {
        if (validator.$debounce) {
          let debounceHandler = debounceMap.get(this as Effect<BaseField<unknown>>);
          if (!debounceHandler) {
            debounceHandler = new DebounceHandler(async () => {
              await validator.$doValidate(field as unknown as ToOmitParentFields<Partial<T>>, updateField);
              debounceMap.set(this as Effect<BaseField<unknown>>, undefined);
            }, validator.$debounce);
            debounceMap.set(this as Effect<BaseField<unknown>>, debounceHandler);
            await debounceHandler.wait();
          } else {
            // debounce的时候需要用最新的effect去执行
            debounceHandler.reset(async () => {
              await validator.$doValidate(field as unknown as ToOmitParentFields<Partial<T>>, updateField);
              debounceMap.set(this as Effect<BaseField<unknown>>, undefined);
            });
            await debounceHandler.wait();
          }
        } else {
          await validator.$doValidate(field as unknown as ToOmitParentFields<Partial<T>>, updateField);
        }
      },
    };
  }
}

export class ValidatorCompose<T> extends Validator<T> {
  $validators: Validator<T>[] = [];
}

// 组合的validator应该关注都是同一个部分的信息，所以他们的watch都是统一的
export class SequenceValidator<T> extends ValidatorCompose<T> {
  constructor(validators: Validator<T>[]) {
    super({ validate: async () => {} });
    this.$validators = validators;
  }

  async $doValidate(field: ToOmitParentFields<Partial<T>>, updateState: UpdateFieldStateCallback): Promise<void> {
    for (const validator of this.$validators) {
      await validator.$doValidate(field, updateState);
    }
  }
}

export class ParallelValidator<T> extends ValidatorCompose<T> {
  constructor(validators: Validator<T>[]) {
    super({ validate: async () => {} });
    this.$validators = validators;
  }

  async $doValidate(field: ToOmitParentFields<Partial<T>>, updateState: UpdateFieldStateCallback): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const validator of this.$validators) {
      promises.push(validator.$doValidate(field, updateState));
    }
    return Promise.allSettled(promises).then(() => undefined);
  }
}
