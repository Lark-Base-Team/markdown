/// <reference types="vite/client" />

// Element Plus类型声明
declare module 'element-plus/global';

// Vue文件声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 图片声明
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';

// 使用ref时不需要value
declare global {
  import type { Ref } from 'vue';
  type UnwrapRef<T> = T extends Ref<infer R> ? R : T;
} 