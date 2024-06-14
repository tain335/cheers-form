import { NonEnumerable } from './decorator';
import { EffectExecutor } from './executor';
import { BaseField } from './field';
import { $FieldGroup, FieldGroupChildrenType, FieldGroupOpts } from './field_group';
import { debug } from './log';

export class $Form<T extends Record<string, any>> extends $FieldGroup<T> {
  @NonEnumerable
  $executor = new EffectExecutor();

  @NonEnumerable
  $waitForExecutorDone(): Promise<void> {
    if (this.$parent) {
      this.$parent.$waitForExecutorDone();
    }
    this.$executor.schedule([]);
    return new Promise((resolve) => {
      this.$executor.onceDone(() => {
        resolve();
      });
    });
  }

  @NonEnumerable
  $markDirty() {
    this.$dirty = true;
    if (this.$parent) {
      this.$parent.$markDirty();
    } else {
      const dirtyFields: BaseField<unknown>[] = [];
      const traverse = (field: BaseField<unknown>) => {
        if (field.$dirty) {
          field.$eachField((f) => {
            if (f.$dirty) {
              traverse(f);
              if (f.$pendingEffects.length) {
                dirtyFields.push(f);
              }
            } else {
              f.$dirty = false;
            }
            return true;
          });
          if (field.$pendingEffects.length) {
            dirtyFields.push(field);
          } else {
            field.$dirty = false;
          }
        }
      };
      traverse(this as BaseField<unknown>);
      debug(`[Form] receive dirty fields count: ${dirtyFields.length}`);
      if (dirtyFields.length) {
        this.$executor.schedule(dirtyFields);
      }
    }
  }
}

function Wrapper<T extends Record<string, any>>(): new <T extends Record<string, any> = Record<string, unknown>>(
  children: FieldGroupChildrenType<T>,
  opts?: FieldGroupOpts<T>,
) => FieldGroupChildrenType<T> & $FieldGroup<T> {
  return class {
    constructor(children: FieldGroupChildrenType<T>, opts?: FieldGroupOpts<T>) {
      return new $Form(children, opts);
    }
  } as any;
}

export const Form = Wrapper();
