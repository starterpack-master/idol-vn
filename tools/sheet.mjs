import fs from 'node:fs'; import { chromium } from 'playwright';
const dir = process.argv[2], files = fs.readdirSync(dir).filter(f=>f.endsWith('.png')&&!f.startsWith('sheet')).sort();
const b = await chromium.launch({args:['--no-sandbox']}); const p = await b.newPage({viewport:{width:1400,height:900}});
for (let k=0;k<files.length;k+=7){ const part=files.slice(k,k+7);
await p.setContent(`<body style="margin:0;background:#222;display:flex;gap:6px;flex-wrap:wrap">${part.map(f=>`<div style="color:#fff;font:12px sans-serif"><div>${f}</div><img src="data:image/png;base64,${fs.readFileSync(dir+'/'+f).toString('base64')}" style="width:193px"></div>`).join('')}</body>`);
await p.screenshot({path:`${dir}/sheet${k/7}.png`,fullPage:true}); }
await b.close();
