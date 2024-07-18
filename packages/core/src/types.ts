import { BaseField, Field } from './field';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';

// 用来标记字段的值为对象或者数组类型
export interface FieldType<T> {
  _marker?: never;
}

export type Extract<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;

// union 分发的特性
type ToField<T> = T extends boolean ? Field<boolean> : T extends any ? Field<Extract<T>> : never;

export type ToFields<T> = T extends FieldType<infer P>
  ? Field<P>
  : T extends Array<any>
  ? FieldArray<T>
  : T extends Record<string, any>
  ? FieldGroup<T>
  : ToField<T>;

export type OmitParent<T extends BaseField<any>> = Omit<T, '$parent'>;

type ToOmitParentField<T> = T extends boolean
  ? OmitParent<Field<boolean>>
  : T extends any
  ? OmitParent<Field<Extract<T>>>
  : never;

export type ToOmitParentFields<T> = T extends FieldType<infer P>
  ? OmitParent<Field<P>>
  : T extends Array<any>
  ? OmitParent<FieldArray<T>>
  : T extends Record<string, any>
  ? OmitParent<FieldGroup<T>>
  : ToOmitParentField<T>;
