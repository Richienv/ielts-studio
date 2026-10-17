import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { assessmentPlugin } from './assessment-plugin';
export default defineConfig(({mode})=>({plugins:[react(),assessmentPlugin({...process.env,...loadEnv(mode,process.cwd(),'')} as Record<string,string>)],server:{host:'127.0.0.1',port:4173,strictPort:true},test:{include:['src/**/*.test.ts']}}));
