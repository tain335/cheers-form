import { NonEnumerable } from './decorator';
import { EffectType } from './effect';
import { EffectExecutor } from './executor';
import { BaseField } from './field';
import { FieldCompose } from './field_compose';
import { $FieldGroup, FieldGroupChildrenType, FieldGroupOpts } from './field_group';
import { debug } from './log';
import { addFlag, hasFlag, removeFlag } from './utils';

export class $Form<T extends Record<string, any>> extends $FieldGroup<T> {
  @NonEnumerable
  $executor = new EffectExecutor();

  constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
    super(children, opts);
    this.$executor.registerResolver((flag: number) => {
      const dirtyFields: BaseField<unknown>[] = [];
      const traverse = (field: BaseField<unknown>) => {
        if (hasFlag(field.$flag, flag)) {
          if (field instanceof FieldCompose) {
            field.$eachField((f) => {
              if (f.$flag) {
                traverse(f);
              }
              return true;
            });
          }
          if (field.$pendingEffects.length) {
            dirtyFields.push(field);
          } else {
            field.$flag = removeFlag(field.$flag, flag);
          }
        }
      };
      traverse(this as BaseField<unknown>);
      debug(`[Form] receive dirty fields count: ${dirtyFields.length}`);
      return dirtyFields;
    });
  }

  @NonEnumerable
  $rootExecutor() {
    if (!this.$parent) {
      return this.$executor;
    }
    return this.$parent.$rootExecutor();
  }

  @NonEnumerable
  $markFlag(flag: number) {
    this.$flag = addFlag(this.$flag, flag);
    if (this.$parent) {
      this.$parent.$markFlag(flag);
    } else if (hasFlag(this.$flag, EffectType.Sync)) {
      this.$executor.exec();
    } else if (hasFlag(this.$flag, EffectType.Async)) {
      this.$executor.schedule();
    }
  }
}

export type FormType<T extends Record<string, any>> = FieldGroupChildrenType<T> & $FieldGroup<T>;

function Wrapper<T extends Record<string, any>>(): new <T extends Record<string, any> = Record<string, unknown>>(
  children: FieldGroupChildrenType<T>,
  opts?: FieldGroupOpts<T>,
) => FormType<T> {
  return class {
    constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
      return new $Form(children, opts);
    }
  } as any;
}

export const Form = Wrapper();
