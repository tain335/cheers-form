import { Field } from './field';
import { FieldArray } from './field_array';
import { ValidType } from './field_state';
import { Form } from './form';
import { Validator } from './validator';

test('[form] empty', () => {
  const form = new Form({});
});

type FormModel = {
  name: string;
  books: boolean[];
  address: string[];
};

test('[form] include value', () => {
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

test('[form] initial unknown', async () => {
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
});

test('[form] single name required', async () => {
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

  await form.$onValidate();
});

test('[form] with number: 1', async () => {
  const form = new Form<{ input: number }>({
    input: new Field<number>(undefined, {
      receive: (v) => (!v ? '' : String(v)),
      transform: (v) => Number(v),
      validators: [
        new Validator({
          trigger: 'manual',
          async validate(field, updateState) {
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'input required' });
            }
          },
        }),
      ],
    }),
  });
  expect(form.$valid).toBe(ValidType.Valid);
  await form.$onValidate();
  form.input.$onChange('3');
  await form.$onValidate();
  expect(form.input.$value).toBe(3);
});

test('[form] with number: 2', async () => {
  const form = new Form<{ input: number }>({
    input: new Field<number>(undefined, {
      receive: (v) => (!v ? '' : String(v)),
      transform: (v) => Number(v),
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'input required' });
            }
          },
        }),
      ],
    }),
  });
  expect(form.$valid).toBe(ValidType.Valid);
  form.input.$onChange('3');
  await form.$onValidate();
  expect(form.input.$value).toBe(3);
});

test('[form] with number 3', async () => {
  const form = new Form<{ input: number }>({
    input: new Field<number>(undefined, {
      receive: (v) => (!v ? '' : String(v)),
      transform: (v) => Number(v),
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'input required' });
            }
          },
        }),
      ],
    }),
  });
  expect(form.$valid).toBe(ValidType.Valid);
  form.input.$onChange('3');
  form.input.$onChange('');
  await form.$onValidate();
  expect(form.input.$valid).toBe(ValidType.Valid);
});

test('[form] with number 4', async () => {
  const form = new Form<{ input: number }>({
    input: new Field<number>(undefined, {
      receive: (v) => (!v ? '' : String(v)),
      transform: (v) => Number(v),
      valid: ValidType.Unknown,
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'input required' });
            } else if (!/\d+/.test(field.$raw)) {
              updateState(field, { valid: ValidType.Invalid, message: 'number input required' });
            }
          },
        }),
      ],
    }),
  });
  expect(form.$valid).toBe(ValidType.Unknown);
  form.input.$onChange('3');
  await form.input.$waitForExecutorDone();
  expect(form.input.$valid).toBe(ValidType.Valid);
  form.input.$onChange('a');
  await form.$onValidate();
  expect(form.input.$valid).toBe(ValidType.Invalid);
});

test('[form] with compose', async () => {
  const form = new Form<{ input: number }>(
    {
      input: new Field<number>(undefined, {
        receive: (v) => (!v ? '' : String(v)),
        transform: (v) => Number(v),
        valid: ValidType.Unknown,
        validators: [
          new Validator({
            trigger: 'change',
            async validate(field, updateState) {
              if (!field.$raw) {
                updateState(field, { valid: ValidType.Invalid, message: 'input required' });
              } else if (!/\d+/.test(field.$raw)) {
                updateState(field, { valid: ValidType.Invalid, message: 'number input required' });
              }
            },
          }),
        ],
      }),
    },
    {
      validators: [
        new Validator({
          debounce: 300,
          watch(field) {
            return [field.$childrenState];
          },
          async validate(field, updateState) {
            if (field.input.$selfValid === ValidType.Valid) {
              if (field.input.$value && field.input.$value > 0) {
                updateState(field.input, { valid: ValidType.Invalid });
              }
            }
          },
        }),
      ],
    },
  );
  expect(form.$valid).toBe(ValidType.Unknown);
  form.input.$onChange('3');
  await form.input.$waitForExecutorDone();
  expect(form.input.$valid).toBe(ValidType.Invalid);
  form.input.$onChange('a');
  await form.$onValidate();
  expect(form.input.$valid).toBe(ValidType.Invalid);
});

test('[form] with self modified', async () => {
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
  form.name.$onChange('test');
  expect(form.name.$selfModified).toBe(true);
  expect(form.name.$modified).toBe(true);
  expect(form.name.$manualSelfModified).toBe(true);
  expect(form.name.$manualModified).toBe(true);
  expect(form.$modified).toBe(true);
  expect(form.$manualModified).toBe(true);
  form.$onReset();
  expect(form.name.$selfModified).toBe(false);
  expect(form.name.$modified).toBe(false);
  expect(form.name.$manualSelfModified).toBe(false);
  expect(form.name.$manualModified).toBe(false);
  expect(form.$modified).toBe(false);
  expect(form.$manualModified).toBe(false);
});
