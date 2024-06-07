// import { StateArrayNode, StateGroupNode, StateNode } from './field_state';

import { UpdateFieldStateCallback } from './executor';
import { Field } from './field';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';
import { genId } from './id';

export type ValidateFieldState<T> = T extends object ? FieldGroup<T> : T extends Array<any> ? FieldArray<T> : Field<T>;

interface ValidatorOptions<T> {
  validate: (field: ValidateFieldState<Partial<T>>, updateState: UpdateFieldStateCallback) => Promise<void>;
  watch?: (field: ValidateFieldState<Partial<T>>) => any[];
  trigger?: 'blur' | 'change' | 'any';
}

export class Validator<T> {
  id: number = genId();

  trigger: 'blur' | 'change' | 'any' = 'change';

  private $$validateCallback: ValidatorOptions<T>['validate'];

  $watch?: ValidatorOptions<T>['watch'] = () => [];

  constructor({ validate, watch, trigger }: ValidatorOptions<T>) {
    this.$$validateCallback = validate;
    this.$watch = watch;
    this.trigger = trigger ?? 'change';
  }

  async $doValidate(field: ValidateFieldState<Partial<T>>, updateState: UpdateFieldStateCallback) {
    await this.$$validateCallback(field, updateState);
  }
}

export class SimpleValidator<T> extends Validator<T> {}

export class ComposeValidator<T> extends Validator<T> {
  $validators: Validator<T>[] = [];

  constructor(validators: Validator<T>[]) {
    super({ validate: async () => {} });
    this.$validators = validators;
  }

  async $doValidate(field: ValidateFieldState<Partial<T>>, updateState: UpdateFieldStateCallback): Promise<void> {
    for (const validator of this.$validators) {
      await validator.$doValidate(field, updateState);
    }
  }
}
