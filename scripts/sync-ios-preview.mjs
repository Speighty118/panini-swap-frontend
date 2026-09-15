import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const html = readFileSync('dist/index.html','utf8');
if (!html.includes('Content-Security-Policy') || !html.includes('connect-src')) throw new Error('Build isolated preview assets first: npm run build');
for (const file of readdirSync('dist/assets').filter(f=>f.endsWith('.js'))) {
 if (/panini-swap-production|gotonespare\.com\/api/.test(readFileSync(`dist/assets/${file}`,'utf8'))) throw new Error('Production endpoint found in preview bundle');
}
const original=readFileSync('capacitor.config.json','utf8');
const config=JSON.parse(original);
try {
 writeFileSync('capacitor.config.json', JSON.stringify({...config,appId:'com.gotonespare.app.preview',appName:'Got One Spare Preview'},null,2)+'\n');
 execFileSync('./node_modules/.bin/cap',['sync','ios'],{stdio:'inherit'});
} finally { writeFileSync('capacitor.config.json',original); }
mkdirSync('.preview-ios',{recursive:true});
const plist=readFileSync('ios/App/App/Info.plist','utf8').replace('<string>Got One Spare?</string>','<string>Got One Spare Preview</string>');
writeFileSync('.preview-ios/Info.plist',plist);
if(readFileSync('ios/App/App/public/index.html','utf8')!==html) throw new Error('Native web assets are stale');
console.log('Synced fixture bundle. Build with PRODUCT_BUNDLE_IDENTIFIER=com.gotonespare.app.preview CODE_SIGNING_ALLOWED=NO');
console.log(`INFOPLIST_FILE=${resolve('.preview-ios/Info.plist')}`);
