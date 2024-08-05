import { Field, Form, Validator, ValidType } from 'cheers-form-core';

export function sleep(duration: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), duration);
  });
}

export function createLoginForm() {
  return new Form<{ username: string; password: string }>({
    username: new Field('', {
      required: true,
      validators: [
        new Validator({
          async validate(field, updateState) {
            if (!field.$state.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'Username required' });
            }
          },
        }),
      ],
    }),
    password: new Field('', {
      required: true,
      validators: [
        new Validator({
          async validate(field, updateState) {
            if (!field.$state.$raw) {
              updateState(field, { valid: ValidType.Invalid, message: 'Password required' });
            }
          },
        }),
      ],
    }),
  });
}

export function createRegisterForm() {
  return new Form<{ username: string; password: string; confirmPassword: string }>(
    {
      username: new Field('', {
        required: true,
        validators: [
          new Validator({
            async validate(field, updateState) {
              if (!field.$state.$raw) {
                updateState(field, { valid: ValidType.Invalid, message: 'Username required' });
              }
            },
          }),
        ],
      }),
      password: new Field('', {
        required: true,
        validators: [
          new Validator({
            async validate(field, updateState) {
              if (!field.$state.$raw) {
                updateState(field, { valid: ValidType.Invalid, message: 'Password required' });
              }
            },
          }),
        ],
      }),
      confirmPassword: new Field('', {
        required: true,
        validators: [
          new Validator({
            async validate(field, updateState) {
              if (!field.$state.$raw) {
                updateState(field, { valid: ValidType.Invalid, message: 'Confirm Password required' });
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
          async validate(field, updateState) {
            if (field.password.$selfValid === ValidType.Valid && field.confirmPassword.$selfValid === ValidType.Valid) {
              if (field.password.$value !== field.confirmPassword.$value) {
                const updated = updateState(field.confirmPassword, {
                  valid: ValidType.Invalid,
                  message: 'Confirm Password must equal Password',
                });
              }
            }
          },
        }),
      ],
    },
  );
}

export function createAsyncForm() {
  return new Form<{ username: string }>({
    username: new Field('', {
      required: true,
      validators: [
        new Validator({
          async validate(field, updateState) {
            await sleep(1000);
            if (!/^\w+$/g.test(field.$state.$raw)) {
              updateState(field, { valid: ValidType.Invalid, message: 'Username format error' });
            }
          },
        }),
      ],
    }),
  });
}