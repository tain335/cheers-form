import { NonEnumerable } from './decorator';
import { EffectExecutor } from './executor';
import { BaseField } from './field';
import { FieldCompose } from './field_compose';
import { $FieldGroup, FieldGroupChildrenType, FieldGroupOpts } from './field_group';
import { debug } from './log';

export class $Form<T extends Record<string, any>> extends $FieldGroup<T> {
  @NonEnumerable
  $executor = new EffectExecutor();

  constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
    super(children, opts);
    this.$executor.registerResolver(() => {
      const dirtyFields: BaseField<unknown>[] = [];
      const traverse = (field: BaseField<unknown>) => {
        if (field.$dirty) {
          if (field instanceof FieldCompose) {
            field.$eachField((f) => {
              if (f.$dirty) {
                traverse(f);
              }
              return true;
            });
          }
          if (field.$pendingEffects.length) {
            dirtyFields.push(field);
          } else {
            field.$dirty = false;
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
  $markDirty() {
    this.$dirty = true;
    if (this.$parent) {
      this.$parent.$markDirty();
    } else {
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
