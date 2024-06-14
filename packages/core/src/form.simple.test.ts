import { Field } from './field';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';
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

test('[form] initial unknown', (done) => {
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

test('[form] single name required', (done) => {
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

  form.$onValidate().then(() => {
    done();
  });
});

test('[form] with number: 1', (done) => {
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
  form.$onValidate().then(() => {
    form.input.$onChange('3');
    form.$onValidate().then(() => {
      expect(form.input.$value).toBe(3);
      done();
    });
  });
});

test('[form] with number: 2', (done) => {
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
  form.$onValidate().then(() => {
    expect(form.input.$value).toBe(3);
    done();
  });
});

test('[form] with number 3', (done) => {
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
  form.$onValidate().then(() => {
    expect(form.input.$valid).toBe(ValidType.Valid);
    done();
  });
});

test('[form] with number 4', (done) => {
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
  form.input.$waitForExecutorDone().then(() => {
    expect(form.input.$valid).toBe(ValidType.Valid);
    form.input.$onChange('a');
    form.$onValidate().then(() => {
      expect(form.input.$valid).toBe(ValidType.Invalid);
      done();
    });
  });
});
