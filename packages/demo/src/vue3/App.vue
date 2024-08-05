<template>
  <div>
    <h1>LoginForm</h1>
    <CheersForm :form="loginForm">
      <div>
        <span>Username</span>
        <CheersField name="username">
          <template v-slot="{ field, proxy }">
            <Input v-model="proxy.model" :valid="field.$valid" :message="field.$message"></Input>
          </template>
        </CheersField>
      </div>
      <div>
        <span>Password</span>
        <CheersField name="password">
          <template v-slot="{field, proxy}">
            <Input v-model="proxy.model" :valid="field.$valid" :message="field.$message" type="password"></Input>
          </template>
        </CheersField>
      </div>
      <CheersField name="*">
        <template v-slot="{ field }">
          <button type="button" :disabled="field.$valid !== ValidType.Valid" @click="() => field.$onValidate()">
            submit
          </button>
        </template>
      </CheersField>
    </CheersForm>
    <h1>Register Form</h1>
    <CheersForm :form="registerForm">
      <div>
        <span>Username</span>
        <CheersField name="username">
          <template v-slot="{ field, proxy }">
            <Input v-model="proxy.model" :valid="field.$valid" :message="field.$message"></Input>
          </template>
        </CheersField>
      </div>
      <div>
        <span>Password</span>
        <CheersField name="password">
          <template v-slot="{field, proxy}">
            <Input v-model="proxy.model" :valid="field.$valid" :message="field.$message" type="password"></Input>
          </template>
        </CheersField>
      </div>
      <div>
        <span>Password</span>
        <CheersField name="confirmPassword">
          <template v-slot="{field, proxy}">
            <Input v-model="proxy.model" :valid="field.$valid" :message="field.$message" type="password"></Input>
          </template>
        </CheersField>
      </div>
      <CheersField name="*">
        <template v-slot="{ field }">
          <button type="button" :disabled="field.$valid !== ValidType.Valid" @click="() => field.$onValidate()">
            submit
          </button>
        </template>
      </CheersField>
    </CheersForm>
    <h1>Async Form</h1>
    <CheersForm :form="asyncForm">
      <div>
        <span>Username</span>
        <CheersField name="username">
          <template v-slot="{ field, proxy }">
            <Input v-model="proxy.model" :valid="field.$valid" :message="field.$message"></Input>
            Validating: {{ field.$isInProgress() ? 'yes' : 'no' }}
          </template>
        </CheersField>
      </div>
    </CheersForm>
  </div>
</template>
<script lang="ts" setup>
import { createAsyncForm, createLoginForm, createRegisterForm } from '../form';
import Input from './Input.vue';
import { CheersField, CheersForm } from 'cheers-form-vue3';
import { ValidType } from 'cheers-form-core';
const loginForm = createLoginForm();
const registerForm = createRegisterForm();
const asyncForm = createAsyncForm();
</script>
<style>
@import url("../style/App.css");
</style>
