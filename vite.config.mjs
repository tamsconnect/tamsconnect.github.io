import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root:path.join(root,'src'),publicDir:path.join(root,'public'),base:'./',plugins:[react()],resolve:{alias:{'@':path.join(root,'src')}},css:{postcss:path.join(root,'postcss.config.mjs')},build:{outDir:path.join(root,'.build'),emptyOutDir:true,sourcemap:false}});
