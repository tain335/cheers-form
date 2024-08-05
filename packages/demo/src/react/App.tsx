import React, { useMemo } from 'react';
import { ValidType } from 'cheers-form-core';
import { bindField, CheersField, CheersForm } from 'cheers-form-react';
import '../style/App.css';
import { createAsyncForm, createLoginForm, createRegisterForm } from '@src/form';


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


export function App() {
  const loginForm = useMemo(() => {
    return createLoginForm();
  }, []);
  const registerForm = useMemo(() => {
    return createRegisterForm();
  }, []);
  const asyncForm = useMemo(() => createAsyncForm(), []);
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

      <h1>Async Form</h1>
      <CheersForm form={asyncForm}>
        <div>
          <span>Username</span>
          <CheersField name="username">
            {(field) => (
              <>
                <Input {...bindField(field)} valid={field.$valid} message={field.$message} /> validating:{' '}
                {field.$isInProgress() ? 'yes' : 'no'}
              </>
            )}
          </CheersField>
        </div>
      </CheersForm>
    </div>
  );
}
