// import { useEffect, useState, useRef } from 'react';

export const Unknown = 0;
export const Valid = 1;
export const Invalid = 2;

type ValidType = number;
type TaskId = string;
type ValidatorId = number;
type FieldId = number;

type WatchFunc = (fieled: TinyField & TinyFieldGroup) => Array<any>;
type UpdateFieldFunc = (field: BaseField, valid: FiledValidState) => void;
type ValidateFunc = (feild: TinyField & TinyFieldGroup, updateField: UpdateFieldFunc) => void;
type StateUpdateListener = (newState: FieldState, oldState: FieldState) => void;
type FieldValueState = {
  value: any;
  disabled: boolean;
};
type FiledValidState = {
  message: string;
  valid: ValidType;
};
type FieldState = FieldValueState & FiledValidState;

function createPromise() {
  let _resolve;
  let _reject;
  const p = new Promise((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });
  // @ts-ignore
  p.resolve = _resolve;
  // @ts-ignore
  p.reject = _reject;
  return p;
}

class ValidateTaskExecutor {
  inProgressMap: Map<TaskId, number> = new Map();

  inProgressSet: Set<TaskId> = new Set();

  async doTask(task: ValidateTask) {
    const { validator, field, immediate, id } = task;
    const excuteId = this.inProgressMap.get(id);
    const cache: any[] = [];
    const updateField = (field, valid: FiledValidState) => {
      cache.push([field, valid]);
    };

    // const wait = (pending: Promise<any>, duration: number, cb: Function) => {
    //   const timer = setTimeout(() => {
    //     cb();
    //   }, duration);
    //   pending.finally(() => {
    //     clearTimeout(timer);
    //   });
    // };
    try {
      await Promise.resolve(validator.doValidate({ field, immediate, updateField }));
      // wait(validatePending, 64, () => {
      //   const result = field.validatorToResultMap.get(validator.id);
      //   if (result) {
      //     field.setValid(validator.id, { ...result, validating: true });
      //   } else {
      //     // @ts-ignore
      //     field.setValid(validator.id, { validating: true });
      //   }
      // });
      // await validatePending;
    } catch (err) {
      console.error(err);
    } finally {
      // 如果validator有新的准备执行或者已经执行，则跳过这次更新，防止覆盖
      const newExcuteId = this.inProgressMap.get(id);
      if (excuteId === newExcuteId) {
        this.inProgressSet.delete(id);
        cache.forEach(([field, valid]) => {
          field.setValid(validator.id, valid);
        });
      }
    }
  }

  async execute(tasks: ValidateTask[]) {
    const fieldTasks: ValidateTask[] = [];
    const groupTasks: ValidateTask[] = [];
    for (const task of tasks) {
      const { id } = task;
      const excuteId = this.inProgressMap.get(id);
      if (!excuteId) {
        this.inProgressMap.set(id, 1);
      } else {
        this.inProgressMap.set(id, excuteId + 1);
      }
      this.inProgressSet.add(id);
      if (task.field instanceof TinyField) {
        fieldTasks.push(task);
      } else {
        groupTasks.push(task);
      }
    }

    const penddings: Promise<void>[] = [];
    for (const task of fieldTasks) {
      const pending = this.doTask(task);
      penddings.push(pending);
    }
    // field的校验可以并发校验
    await Promise.all(penddings);

    for (const task of groupTasks) {
      await this.doTask(task);
    }
  }
}

class ValidateTask {
  id: TaskId;

  field: BaseField;

  validator: TinyValidator;

  immediate: boolean;

  constructor({
    field,
    validator,
    immediate = false,
  }: {
    field: BaseField;
    validator: TinyValidator;
    immediate?: boolean;
  }) {
    this.id = `${field.id}-${validator.id}`;
    this.field = field;
    this.validator = validator;
    this.immediate = immediate;
  }
}

let validatorId = 0;

export class TinyValidator {
  id: ValidatorId;

  debounce: number;

  debounceTimer: number;

  debouncePending: Promise<any> | null = null;

  watch: WatchFunc;

  validate: ValidateFunc;

  watchDependencies: Array<any>;

  constructor({
    watch = (field) => [field.state],
    validate,
    debounce = 0,
  }: {
    watch?: WatchFunc;
    validate: ValidateFunc;
    debounce?: number;
  }) {
    this.id = validatorId++;
    this.debounce = debounce;
    this.debounceTimer = -1;
    this.watch = watch;
    this.validate = validate;
    this.watchDependencies = [];
  }

  doValidate({ field, immediate, updateField }) {
    if (immediate) {
      return this.validate(field, updateField);
    }
    if (this.debounce) {
      clearTimeout(this.debounceTimer);
      // @ts-ignore
      this.debounceTimer = setTimeout(() => {
        // @ts-ignore
        this.debouncePending.resolve(this.validate(field, updateField));
        this.debouncePending = null;
      }, this.debounce);

      if (this.debouncePending) return this.debouncePending;
      this.debouncePending = createPromise();

      return this.debouncePending;
    }

    return this.validate(field, updateField);
  }

  compareWatchDependencies(newDependencies, oldDependencies) {
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

  shouldCommit(field) {
    const dependencies = this.watchDependencies;
    let newDependencies = this.watch(field);
    if (!Array.isArray(newDependencies)) {
      newDependencies = [newDependencies];
    }
    this.watchDependencies = newDependencies;
    return !this.compareWatchDependencies(newDependencies, dependencies);
  }
}

let fieldId = 0;

class BaseField {
  id: FieldId;

  parent: TinyFieldGroup | null;

  executor: ValidateTaskExecutor | null;

  state: FieldState;

  input: {
    value: any;
    disabled: boolean;
    onChange: (value) => void;
    onBlur: (value) => void;
  };

  validatorToResultMap: Map<number, FiledValidState>;

  stateUpdateListeners: Array<StateUpdateListener>;

  defaultMessage: string;

  ignore: boolean;

  constructor({
    state,
    ignore = false,
    stateUpdateListeners = [],
    defaultMessage = '',
  }: {
    state: FieldState;
    ignore?: boolean;
    stateUpdateListeners?: Array<StateUpdateListener>;
    defaultMessage?: string;
  }) {
    this.id = fieldId++;
    this.parent = null;
    this.executor = null;
    this.state = state;
    this.ignore = ignore;
    this.input = {
      disabled: this.state.disabled,
      value: this.state ? this.state.value : null,
      onChange: this.onChange.bind(this),
      onBlur: this.onBlur.bind(this),
    };
    this.validatorToResultMap = new Map();
    this.stateUpdateListeners = stateUpdateListeners;
    this.defaultMessage = defaultMessage;
  }

  onChange(value) {
    throw new Error('no implement');
  }

  onBlur() {
    throw new Error('no implement');
  }

  setState(newState: FieldState) {
    const oldState = this.state;
    this.state = newState;
    this.input = {
      disabled: this.state.disabled,
      value: this.state.value,
      onChange: this.onChange.bind(this),
      onBlur: this.onBlur.bind(this),
    };
    for (const listener of this.stateUpdateListeners) {
      if (listener) {
        listener(this.state, oldState);
      }
    }
    if (this.parent) this.parent.rebuildState();
  }

  isSelfValid() {
    throw new Error('no implement');
  }

  setValid(validatorId, result: FiledValidState) {
    this.validatorToResultMap.set(validatorId, result);
    const results = Array.from(this.validatorToResultMap.values());
    let newValid = Valid;
    let newMessage = this.defaultMessage;
    for (const result of results) {
      if (newValid === Valid && result.valid === Invalid) {
        newValid = result.valid;
        newMessage = result.message;
      }
    }
    if (this.state.valid !== newValid || this.state.message !== newMessage) {
      if (this instanceof TinyFieldGroup) debugger;
      this.setState({
        value: this.state.value,
        disabled: this.state.disabled,
        valid: newValid,
        message: newMessage,
      });
    }
  }

  setIgnore(ignore: boolean) {
    if (this.ignore === ignore) return;
    this.ignore = ignore;
    if (this.parent) this.parent.rebuildState();
  }

  setDisabled(disabled: boolean) {
    if (this.state.disabled === disabled) return;
    this.setState({
      ...this.state,
      disabled,
    });
  }

  onStateUpdate(listener: StateUpdateListener) {
    this.stateUpdateListeners.push(listener);
  }

  offStateUpdate(listener) {
    let len = this.stateUpdateListeners.length;
    while (len--) {
      if (this.stateUpdateListeners[len] === listener) {
        this.stateUpdateListeners.splice(len, 1);
        break;
      }
    }
  }

  getValidateExecutor() {
    if (this.executor) return this.executor;
    let parent = this.parent;
    do {
      if (parent?.executor) {
        this.executor = parent.executor;
        return this.executor;
      }
      // @ts-ignore
    } while ((parent = parent?.parent));
    throw new Error(`no executor found`);
  }

  isSelfValidating() {
    throw new Error('no implement');
  }

  // // @deprecated useFieldState
  // useInput() {
  //   const state = this.useState();
  //   return {
  //     ...state,
  //     onChange: this.onChange.bind(this),
  //   };
  // }

  // // @deprecated useFieldInput
  // useState() {
  //   const [state, setState] = useState(this.state);
  //   useEffect(() => {
  //     const listener = (state, oldState) => {
  //       setState(state);
  //     };
  //     this.onStateUpdate(listener);
  //     return () => this.offStateUpdate(listener);
  //   }, [this.id]);
  //   return state;
  // }
}

function _isEmpty(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === '' || value === undefined;
}

type TinyFieldProps = {
  validator?: TinyValidator;
  initial: any;
  required?: boolean;
  ignore?: boolean;
  disabled?: boolean;
  defaultMessage?: string;
  validateOnBlur?: boolean;
  onStateUpdate?: (newState: FieldState, oldState: FieldState) => void;
  isEmpty?: (value: any) => boolean;
};

export class TinyField extends BaseField {
  validator: TinyValidator;

  validateOnBlur: boolean;

  required: boolean;

  constructor({
    validator,
    initial,
    required = true,
    ignore = false,
    disabled = false,
    defaultMessage = '',
    validateOnBlur = false,
    onStateUpdate,
    isEmpty = _isEmpty,
  }: TinyFieldProps) {
    let valid = Valid;
    if (required && isEmpty(initial)) {
      valid = Unknown;
    }
    super({
      state: {
        value: initial,
        disabled,
        valid,
        message: defaultMessage,
      },
      ignore,
      stateUpdateListeners: onStateUpdate ? [onStateUpdate] : [],
      defaultMessage,
    });
    if (!validator) {
      if (required) {
        validator = new TinyValidator({
          validate: (field, updateField) => {
            if (isEmpty(field.state.value)) {
              updateField(field, { valid: Invalid, message: '' });
            } else {
              updateField(field, { valid: Valid, message: '' });
            }
          },
        });
      } else {
        validator = new TinyValidator({
          validate: (field, updateField) => updateField(field, { valid: Valid, message: '' }),
        });
      }
    }
    this.required = required;
    this.validator = validator;
    this.validateOnBlur = validateOnBlur;
    if (this.validator) {
      this.validatorToResultMap.set(this.validator.id, {
        valid: this.state.valid,
        message: this.state.message,
      });
    }
  }

  onValidate() {
    if (!this.parent) {
      throw new Error('parent required');
    }
    if (this.ignore) {
      return Promise.resolve();
    }
    if (this.validator) {
      return this.parent.commitValidateTasks([
        new ValidateTask({ validator: this.validator, field: this, immediate: true }),
      ]);
    }
    return this.parent.commitValidateTasks([]);
  }

  onChange(value) {
    this.setState({
      ...this.state,
      value,
    });
    if (this.ignore) {
      return;
    }
    if (!this.validateOnBlur) {
      if (this.validator) {
        if (this.parent)
          this.parent.commitValidateTasks([new ValidateTask({ validator: this.validator, field: this })]);
      }
      if (this.parent) this.parent.commitValidateTasks([]);
    }
  }

  onBlur() {
    if (this.ignore) {
      return;
    }
    if (this.validateOnBlur) {
      if (this.validator) {
        if (this.parent)
          this.parent.commitValidateTasks([new ValidateTask({ validator: this.validator, field: this })]);
      }
      if (this.parent) this.parent.commitValidateTasks([]);
    }
  }

  isSelfValid() {
    if (this.validator) {
      const result = this.validatorToResultMap.get(this.validator.id);
      if (result && result.valid === Valid) {
        return true;
      }
      return false;
    }
    return true;
  }

  isSelfValidating() {
    return this.getValidateExecutor().inProgressSet.has(`${this.id}-${this.validator.id}`);
  }
}

type TinyFieldGroupProps = {
  fields: Array<BaseField> | { [key: string]: BaseField };
  ignore?: boolean;
  disabled?: boolean;
  validators?: Array<TinyValidator>;
  onStateUpdate?: StateUpdateListener;
};

export class TinyFieldGroup extends BaseField {
  fields: any;

  state: FieldState;

  validators: Array<TinyValidator>;

  constructor({ fields, ignore = false, disabled = false, validators = [], onStateUpdate }: TinyFieldGroupProps) {
    super({
      state: { valid: Unknown, value: null, message: '', disabled },
      stateUpdateListeners: onStateUpdate ? [onStateUpdate] : [],
      ignore,
    });
    this.fields = fields;
    this.state = this.mergeState();
    this.setDisabled(disabled);
    this.validators = validators;
  }

  eachField(iterator) {
    if (Array.isArray(this.fields)) {
      this.fields.forEach(iterator);
    } else {
      Object.keys(this.fields).forEach((key, index) => {
        iterator(this.fields[key], index, key);
      });
    }
  }

  mergeTasks() {
    const tasks: ValidateTask[] = [];
    function traverse(groupField: TinyFieldGroup) {
      groupField.eachField((field, index) => {
        if (field instanceof TinyField) {
          tasks.push(
            new ValidateTask({
              validator: field.validator,
              field,
              immediate: true,
            }),
          );
        } else {
          traverse(field);
        }
      });
      (groupField.validators || []).forEach((validator) => {
        tasks.push(
          new ValidateTask({
            validator,
            field: groupField,
            immediate: true,
          }),
        );
      });
    }
    traverse(this);
    return tasks;
  }

  onValidate() {
    if (!this.parent) {
      throw new Error('parent required');
    }
    return this.parent.commitValidateTasks(this.mergeTasks());
  }

  isSelfValid() {
    return this.state.valid === Valid;
  }

  setDisabled(disabled: boolean) {
    this.eachField((field) => {
      field.setDisabled(disabled);
    });
    super.setDisabled(disabled);
  }

  onChange(fields) {
    this.fields = fields;
    this.rebuildState();
    this.commitValidateTasks([]);
  }

  mergeState(): FieldState {
    const isArray = Array.isArray(this.fields);
    const newValue: Array<any> | { [key: string]: any } = isArray ? [] : {};
    let newValid: ValidType = Valid;
    let newMessage = '';
    this.eachField((field: BaseField, index, key) => {
      field.parent = this;
      // 如果字段设置ignore，跳过状态merge
      if (field.ignore) return;
      if (isArray) {
        newValue.push(field.state.value);
      } else {
        newValue[key] = field.state.value;
      }
      if (field.state.valid === Invalid && newValid !== Invalid) {
        newValid = Invalid;
        newMessage = field.state.message;
      } else if (field.state.valid === Unknown && newValid !== Unknown) {
        newValid = Unknown;
        newMessage = '';
      }
    });
    return {
      message: newMessage,
      valid: newValid,
      value: newValue,
      disabled: this.state?.disabled,
    };
  }

  rebuildState() {
    this.setState(this.mergeState());
  }

  commitValidateTasks(tasks) {
    for (const validator of this.validators) {
      if (validator.shouldCommit(this)) {
        tasks.push(
          new ValidateTask({
            validator,
            field: this,
          }),
        );
      }
    }
    if (!this.parent) {
      throw new Error('parent required');
    }
    return this.parent.commitValidateTasks(tasks);
  }

  isSelfValidating() {
    for (const validator of this.validators) {
      const validating = this.getValidateExecutor().inProgressSet.has(`${this.id}-${validator.id}`);
      if (validating) return true;
    }
    return false;
  }
}

// 当value/valid触发改变
// 1. 更新state tree
// 2. 提交关联的validator
export class TinyForm extends TinyFieldGroup {
  executor: ValidateTaskExecutor;

  userTrigger: boolean;

  constructor({
    fields,
    userTrigger = false, // 需要手动触发校验
    disabled = false,
    ignore = false,
    validators = [],
    onStateUpdate,
  }: {
    userTrigger?: boolean;
  } & TinyFieldGroupProps) {
    super({
      fields,
      disabled,
      ignore,
      validators,
      onStateUpdate,
    });
    this.userTrigger = userTrigger;
    this.executor = new ValidateTaskExecutor();
  }

  onValidate() {
    if (this.parent) {
      return super.onValidate();
    }
    return this.commitValidateTasks(this.mergeTasks(), true);
  }

  rebuildState() {
    if (this.parent) {
      super.rebuildState();
    } else {
      const newState = this.mergeState();
      if (newState.valid === Valid && this.executor.inProgressSet.size) {
        newState.valid = Unknown;
        newState.message = '';
      }
      this.setState(newState);
    }
  }

  commitValidateTasks(tasks, force = false) {
    if (this.userTrigger && !force) {
      // userTrigger忽略掉所有校验任务
      return Promise.resolve();
    }
    if (this.parent) {
      // 如果存在parent, 提交给parent处理
      return super.commitValidateTasks(tasks);
    }
    for (const validator of this.validators) {
      if (validator.shouldCommit(this)) {
        tasks.push(
          new ValidateTask({
            validator,
            field: this,
          }),
        );
      }
    }
    // Invalid判断优先级最高
    // Unknown次之
    // Valid最低
    // 这里如果mergeState的valid是有效的，但是还存在validator还没执行，那就应该判断为Unknown
    if (this.state.valid === Valid && (tasks.length || this.executor.inProgressSet.size)) {
      this.setState({
        ...this.state,
        valid: Unknown,
        message: '',
      });
    }
    return this.executor.execute(tasks).then(() => {
      // 一般情况下，validator里面调用了updateField，rebuildState会优先触发，设置正确的状态
      // 但是如果validator什么都没有做，而且这里是Unknown状态这里就需要重新设置
      if (this.state.valid === Unknown && !this.executor.inProgressSet.size) {
        const newState = this.mergeState();
        if (newState.valid !== this.state.valid || newState.message !== this.state.message) {
          this.setState(newState);
        }
      }
    });
  }
}

// export function useFieldInput(field: BaseField) {
//   const state = useFieldState(field);
//   return {
//     ...state,
//     onChange: field.onChange.bind(field),
//   };
// }

// export function useFieldState(field: BaseField) {
//   const [state, setState] = useState(field.state);
//   useEffect(() => {
//     const listener = (state, oldState) => {
//       setState(state);
//     };
//     field.onStateUpdate(listener);
//     return () => field.offStateUpdate(listener);
//   }, [field.id]);
//   return state;
// }
