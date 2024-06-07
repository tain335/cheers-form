import { Field } from './field';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';

test('field array length', () => {
  const arr = new FieldArray<number[]>([new Field(0)]);
  expect(arr.length).toBe(1);
});

test('field array empty', () => {
  const arr = new FieldArray([]);
  expect(arr[0]).toBe(undefined);
});

test('field array include value', () => {
  const arr = new FieldArray<[number, string]>([new Field(0), new Field('bbb')]);
  expect(arr[0].$state.$value).toBe(0);
});

test('field group empty', () => {
  const group = new FieldGroup({});
  expect(JSON.stringify(group.$children)).toBe('{}');
});

test('field group include value', () => {
  const group = new FieldGroup<{ a: number }>({
    a: new Field(0),
  });
  expect(group.a.$state.$value).toBe(0);
});
