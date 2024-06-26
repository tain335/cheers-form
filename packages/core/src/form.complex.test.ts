import { Field } from './field';
import { FieldArray } from './field_array';
import { FieldGroup } from './field_group';
import { ValidType } from './field_state';
import { Form } from './form';
import { Validator } from './validator';

type MultiNoDuplictNameModel = {
  names: string[];
};

test('[form] multi name no duplict', (done) => {
  const form = new Form<MultiNoDuplictNameModel>({
    names: new FieldArray([], {
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            const set = new Set();
            field.$children.forEach((f, index) => {
              if (f.$selfPass) {
                if (!set.has(f.$value)) {
                  set.add(f.$value);
                } else {
                  updateState(f, { valid: ValidType.Invalid, message: 'duplict name' });
                }
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

test('[form] multi name no duplict and remove', (done) => {
  const form = new Form<MultiNoDuplictNameModel>({
    names: new FieldArray([], {
      validators: [
        new Validator({
          trigger: 'change',
          async validate(field, updateState) {
            const set = new Set();
            field.$children.forEach((f, index) => {
              if (f.$selfPass) {
                if (!set.has(f.$value)) {
                  set.add(f.$value);
                } else {
                  updateState(f, { valid: ValidType.Invalid, message: 'duplict name' });
                }
              }
            });
          },
        }),
      ],
    }),
  });
  const fields = [new Field('nick'), new Field('nick2')];
  form.names.$onChange(fields);
  expect(form.$selfValid).toBe(ValidType.Unknown);
  form.$waitForExecutorDone().then(() => {
    expect(form.$valid).toBe(ValidType.Valid);
    expect(form.names.$value).toEqual(['nick', 'nick2']);
    const duplictField = new Field('nick');
    form.names.$onChange([...fields, duplictField]);

    expect(form.$raw.names.length).toBe(3);
    expect(form.$valid).toBe(ValidType.Unknown);

    form.$waitForExecutorDone().then(() => {
      expect(form.$valid).toBe(ValidType.Invalid);
      form.names.$onChange(fields.slice(1).concat([duplictField]));
      form.$waitForExecutorDone().then(() => {
        expect(form.$valid).toBe(ValidType.Valid);
        done();
      });
    });
  });
});

test('[form] nest form', (done) => {
  const courseForm = new Form<{ courses: string[] }>({
    courses: new FieldArray([], {
      validators: [
        new Validator({
          async validate(field, updateState) {
            const set = new Set();
            field.$children.forEach((f, index) => {
              if (f.$selfPass) {
                if (!set.has(f.$value)) {
                  set.add(f.$value);
                } else {
                  updateState(f, { valid: ValidType.Invalid, message: 'duplict course' });
                }
              }
            });
          },
        }),
      ],
    }),
  });
  const studentForm = new Form<{ name: string; myCourses: { courses: string[] } }>({
    name: new Field('', {
      valid: ValidType.Invalid,
      validators: [
        new Validator({
          async validate(field, updateState) {
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'name required' });
            }
          },
        }),
      ],
    }),
    myCourses: courseForm,
  });
  studentForm.myCourses.courses.$onChange([new Field('YuWen'), new Field('ShuXue')]);
  studentForm.$waitForExecutorDone().then(() => {
    expect(studentForm.$valid).toBe(ValidType.Invalid);
    studentForm.name.$onChange('Bob');
    expect(studentForm.name.$selfValid).toBe(ValidType.Unknown);
    expect(studentForm.name.$valid).toBe(ValidType.Unknown);
    studentForm.$waitForExecutorDone().then(() => {
      expect(studentForm.$valid).toBe(ValidType.Valid);
      expect(studentForm.$value).toEqual({ name: 'Bob', myCourses: { courses: ['YuWen', 'ShuXue'] } });
      done();
    });
  });
});

test('[form] nest form validate at first time', (done) => {
  const courseForm = new Form<{ courses: string[] }>({
    courses: new FieldArray([new Field('YuWen'), new Field('ShuXue')], {
      valid: ValidType.Unknown,
      validators: [
        new Validator({
          async validate(field, updateState) {
            const set = new Set();
            field.$children.forEach((f, index) => {
              if (f.$selfPass) {
                if (!set.has(f.$value)) {
                  set.add(f.$value);
                } else {
                  updateState(f, { valid: ValidType.Invalid, message: 'duplict course' });
                }
              }
            });
          },
        }),
      ],
    }),
  });
  const studentForm = new Form<{ name: string; myCourses: { courses: string[] } }>({
    name: new Field('', {
      valid: ValidType.Unknown,
      validators: [
        new Validator({
          async validate(field, updateState) {
            if (!field.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'name required' });
            }
          },
        }),
      ],
    }),
    myCourses: courseForm,
  });
  studentForm.$onValidate().then((state) => {
    expect(state.$valid).toBe(ValidType.Invalid);
    expect(studentForm.name.$valid).toBe(ValidType.Invalid);
    done();
  });
});

test('[form] ignore field', (done) => {});
