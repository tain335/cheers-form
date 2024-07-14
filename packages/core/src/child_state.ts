import { BaseField, EffectSource } from './field';
import { ValidType } from './field_state';
import { DependencyCompare } from './utils';

export class ChildrenState extends DependencyCompare {
  constructor(
    public $valid: ValidType,
    public $raw: any,
    public $effectSources: Map<any, EffectSource[]>,
    public $unknownFields: BaseField<unknown>[],
    public $invalidFields: BaseField<unknown>[],
  ) {
    super();
  }

  isEqual(other: ChildrenState): boolean {
    const equal = this.$valid === other.$valid && this.$raw === other.$raw;
    return equal;
  }
}
