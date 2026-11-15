import { readFileSync, writeFileSync } from 'node:fs';
const files = ['js/data.js','js/storage.js','js/modules/utils.js','js/modules/credits.js','js/modules/opportunities.js','js/modules/projects.js','js/modules/notifications.js','js/app.js'];
const body = files.map(f => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n');
const out = '/* Colabre - bundle classico (funciona abrindo index.html direto, sem servidor) */\n(function(){\n"use strict";\n' + body + '\n})();\n';
writeFileSync('js/bundle.js', out, 'utf8');
console.log('bundle ok', out.length);
