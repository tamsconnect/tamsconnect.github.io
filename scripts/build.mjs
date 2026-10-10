import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({configFile:path.join(root,'vite.config.mjs')});
// These directories contain only generated output and stay inside this project.
const assets=path.resolve(root,'assets');
const staging=path.resolve(root,'.build');
if(path.dirname(assets)!==root||path.dirname(staging)!==root)throw new Error('Unsafe build output path.');
fs.rmSync(assets,{recursive:true,force:true});
for(const entry of fs.readdirSync(path.join(root,'.build')))fs.cpSync(path.join(root,'.build',entry),path.join(root,entry),{recursive:true});
fs.writeFileSync(path.join(root,'.nojekyll'),'');
fs.rmSync(staging,{recursive:true,force:true});
console.log('Upload-ready website rebuilt at the project root.');
