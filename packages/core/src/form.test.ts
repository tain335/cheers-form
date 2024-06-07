import { Field } from './field';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';
import { ValidType } from './field_state';
import { Form } from './form';
import { Validator } from './validator';

test('form empty', () => {
  const form = new Form({});
});

type FormModel = {
  name: string;
  books: boolean[];
  address: string[];
};

test('form include value', () => {
  const validator = new Validator<{ name: string }>({
    validate: async (field, updateState) => {
      updateState(field, { disabled: true });
    },
  });
  const form = new Form<FormModel>(
    {
      name: new Field(''),
      books: new FieldArray([]),
      address: new FieldArray([new Field('string'), new Field('string2')]),
    },
    {
      validators: [
        new Validator({
          watch: (field) => [field.books.$value?.length],
          validate: async (field) => {},
        }),
        validator,
      ],
    },
  );
});

type SingleRequiredName = {
  name: string;
};

test('form initial unknown', (done) => {
  const form = new Form<SingleRequiredName>({
    name: new Field('', {
      valid: ValidType.Unknown,
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            expect(typeof field.$value?.length).toBe('number');
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'name required' });
            }
          },
        }),
      ],
    }),
  });

  expect(form.$valid).toBe(ValidType.Unknown);
  done();
});

type MultiNoDuplictNameModel = {
  names: string[];
};

test('form multi name no duplict', (done) => {
  const form = new Form<MultiNoDuplictNameModel>({
    names: new FieldArray([], {
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            const set = new Set();
            field.$value?.forEach((value, index) => {
              if (!set.has(value)) {
                set.add(value);
              } else {
                updateState(field.$children[index], { valid: ValidType.Invalid, message: 'duplict name' });
              }
            });
          },
        }),
      ],
    }),
  });
  const fields = [new Field('nick'), new Field('nick2')];
  form.names.$onChange(fields);
  expect(form.$raw.names.length).toBe(2);
  expect(form.$valid).toBe(ValidType.Unknown);
  form.$waitForExecutorDone().then(() => {
    expect(form.$valid).toBe(ValidType.Valid);
    expect(form.names.$value).toEqual(['nick', 'nick2']);
    form.names.$onChange([...fields, new Field('nick')]);

    expect(form.$raw.names.length).toBe(3);
    expect(form.$valid).toBe(ValidType.Unknown);

    form.$waitForExecutorDone().then(() => {
      expect(form.$valid).toBe(ValidType.Invalid);
      done();
    });
  });
});
