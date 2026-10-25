import { defineConfig } from 'tsup';

export default defineConfig([
  // Main ESM and CJS entrypoints
  {
    entry: {
      index: 'src/index.ts',
      react: 'src/react.ts',
      'react-native': 'src/react-native.ts',
      vue: 'src/vue.ts',
      svelte: 'src/svelte.ts',
      angular: 'src/angular.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2022',
    treeshake: true,
    external: ['react', 'react-native'],
  },
  // IIFE browser bundle for <script> tag usage
  {
    entry: {
      'bkash-client.browser': 'src/index.ts',
    },
    format: ['iife'],
    globalName: 'BkashClient',
    sourcemap: true,
    target: 'es2020',
    clean: false,
    outDir: 'dist',
  },
]);
