import React, { useMemo } from 'react';
import { Field, Form, Validator, ValidType } from 'cheers-form-core';
import { bindField, CheersField, CheersForm } from 'cheers-form-react';
import './App.css';

interface InputProps {
  onChange?: (value: any) => void;
  onBlur?: () => void;
  value?: any;
  valid?: ValidType;
  message?: string;
  type?: string;
}

function Input({ onBlur, onChange, value, valid, message, type }: InputProps) {
  return (
    <>
      <input
        className={valid === ValidType.Invalid ? 'error' : ''}
        onBlur={onBlur}
        onChange={onChange}
        value={value}
        type={type}
      />
      <div className={valid === ValidType.Invalid ? 'error' : ''}>{message}</div>
    </>
  );
}

function createLoginForm() {
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

function createRegisterForm() {
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

export function App() {
  const loginForm = useMemo(() => {
    return createLoginForm();
  }, []);
  const registerForm = useMemo(() => {
    return createRegisterForm();
  }, []);
  return (
    <div>
      <h1>Login Form</h1>
      <CheersForm form={loginForm}>
        <div>
          <span>Username</span>
          <CheersField name="username">
            {(field) => (
              <>
                <Input {...bindField(field)} valid={field.$valid} message={field.$message} />
              </>
            )}
          </CheersField>
        </div>

        <div>
          <span>Password</span>
          <CheersField name="password">
            {(field) => (
              <>
                <Input {...bindField(field)} valid={field.$valid} message={field.$message} type="password" />
              </>
            )}
          </CheersField>
        </div>
        <CheersField name="*">
          {(field) => {
            return (
              <button type="button" disabled={field.$valid !== ValidType.Valid} onClick={() => field.$onValidate()}>
                submit
              </button>
            );
          }}
        </CheersField>
      </CheersForm>

      <h1>Register Form</h1>
      <CheersForm form={registerForm}>
        <div>
          <span>Username</span>
          <CheersField name="username">
            {(field) => (
              <>
                <Input {...bindField(field)} valid={field.$valid} message={field.$message} />
              </>
            )}
          </CheersField>
        </div>

        <div>
          <span>Password</span>
          <CheersField name="password">
            {(field) => (
              <>
                <Input {...bindField(field)} valid={field.$valid} message={field.$message} type="password" />
              </>
            )}
          </CheersField>
        </div>
        <div>
          <span>Confirm Password</span>
          <CheersField name="confirmPassword">
            {(field) => (
              <>
                <Input {...bindField(field)} valid={field.$valid} message={field.$message} type="password" />
              </>
            )}
          </CheersField>
        </div>
        <CheersField name="*">
          {(field) => {
            return (
              <button type="button" disabled={field.$valid !== ValidType.Valid} onClick={() => field.$onValidate()}>
                submit
              </button>
            );
          }}
        </CheersField>
      </CheersForm>
    </div>
  );
}
