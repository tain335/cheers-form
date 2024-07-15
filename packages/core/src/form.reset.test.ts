import { Field } from './field';
import { FieldArray } from './field_array';
import { ValidType } from './field_state';
import { Form } from './form';
import { FieldType } from './types';
import { Validator } from './validator';

type FormModel = {
  name: string;
  books: boolean[];
  address: string[];
  marker: FieldType<string[]>;
};

test('[form] update child field', async () => {
  const form = new Form<FormModel>(
    {
      name: new Field(''),
      books: new FieldArray([]),
      address: new FieldArray([new Field('string'), new Field('string2')]),
      marker: new Field<string[]>([]),
    },
    {
      validators: [
        new Validator({
          watch: (field) => {
            return [field.books.$value?.length];
          },
          validate: async (field) => {},
        }),
      ],
    },
  );
  expect(form.$value).toEqual({ name: '', books: [], address: ['string', 'string2'], marker: [] });

  form.name = new Field('AAA');
  expect(form.$value).toEqual({ name: 'AAA', books: [], address: ['string', 'string2'], marker: [] });

  form.address = new FieldArray([new Field('AAA'), new Field('BBB')]);
  expect(form.$value).toEqual({ name: 'AAA', books: [], address: ['AAA', 'BBB'], marker: [] });

  form.address[0] = new Field('CCC');
  expect(form.$value).toEqual({ name: 'AAA', books: [], address: ['CCC', 'BBB'], marker: [] });
});

test('[form] reset', async () => {
  const form = new Form<FormModel>(
    {
      name: new Field(''),
      books: new FieldArray([]),
      address: new FieldArray([new Field('string'), new Field('string2')]),
      marker: new Field<string[]>([]),
    },
    {
      validators: [
        new Validator({
          watch: (field) => {
            return [field.books.$value?.length];
          },
          validate: async (field, updateField) => {
            if (!field.books.length) {
              updateField(field.books, { valid: ValidType.Invalid });
            }
          },
        }),
      ],
    },
  );
  expect(form.$value).toEqual({ name: '', books: [], address: ['string', 'string2'], marker: [] });
  expect(form.$valid).toBe(ValidType.Valid);
  form.name = new Field('AAA');
  expect(form.$value).toEqual({ name: 'AAA', books: [], address: ['string', 'string2'], marker: [] });

  form.address = new FieldArray([new Field('AAA'), new Field('BBB')]);
  expect(form.$value).toEqual({ name: 'AAA', books: [], address: ['AAA', 'BBB'], marker: [] });

  await form.$onValidate();
  expect(form.$valid).toBe(ValidType.Invalid);
  form.$onReset();
  expect(form.$value).toEqual({ name: '', books: [], address: ['string', 'string2'], marker: [] });
  expect(form.$valid).toBe(ValidType.Valid);
});
