import { NonEnumerable } from './decorator';

export enum ValidType {
  Unknown = 0,
  Valid = 1,
  Invalid = 2,
}

export type FieldStateOpts<T> = {
  value: T | undefined;
  raw: any;
  disabled: boolean;
  ignore: boolean;
  required: boolean;
};

export class FieldState<T> {
  @NonEnumerable
  $value: T | undefined;

  @NonEnumerable
  $raw: any;

  // 无法修改值
  @NonEnumerable
  $disabled = false;

  // 不参与校验和输出
  @NonEnumerable
  $ignore = false;

  @NonEnumerable
  $required = false;

  constructor(opts: FieldStateOpts<T>) {
    this.$value = opts.value;
    this.$raw = opts.raw;
    this.$ignore = opts.ignore;
    this.$disabled = opts.disabled;
    this.$required = opts.required;
  }

  isEqual(newState: FieldState<T>) {
    return (
      this.$disabled === newState.$disabled &&
      this.$ignore === newState.$ignore &&
      this.$raw === newState.$raw &&
      this.$value === newState.$value
    );
  }
}
