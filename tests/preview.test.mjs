import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '@babel/parser';
import { previewRequest as request, resetFixtures } from '../src/preview/api.js';
import config from '../vite.config.js';

const src = readFileSync('src/App.jsx', 'utf8');
const baseline = execFileSync('git', ['show', '69ad8aa:src/App.jsx'], { encoding: 'utf8' });
const declarations = source => new Map(parse(source, { sourceType: 'module', plugins: ['jsx'] }).program.body.flatMap(n => n.type === 'FunctionDeclaration' ? [[n.id.name, source.slice(n.start,n.end)]] : n.type === 'VariableDeclaration' ? n.declarations.map(d => [d.id.name, source.slice(d.init?.start,d.init?.end)]) : []));
test('existing API contract and sensitive utilities are unchanged', () => {
 const before=declarations(baseline), after=declarations(src);
 for(const name of ['api','getSwapLabel','resizeImageFile','WC2026_GROUP_ORDER','ALBUM_CONFIG','sortTeamsByGroup','sortStickersByAlbumOrder']) {
  if(!before.has(name)) continue;
  assert.equal(after.get(name),before.get(name),name);
 }
 assert.match(src,/const FOUNDER_ENABLED = false/);
});
test('preview defaults to fixtures and rejects any API configuration', async () => {
 const previous = {...process.env};
 try {
  delete process.env.VITE_APP_ENV; delete process.env.VITE_API_BASE_URL;
  const c=await config({mode:'test'}); assert.equal(c.server.host,'127.0.0.1'); assert.match(c.server.headers['Content-Security-Policy'],/connect-src 'self'/);
  process.env.VITE_API_BASE_URL='https://example.invalid/api';
  assert.throws(()=>config({mode:'test'}),/do not configure an API/);
  process.env.VITE_APP_ENV='production'; delete process.env.VITE_API_BASE_URL;
  assert.throws(()=>config({mode:'test'}),/explicit HTTPS/);
 } finally { for(const k of ['VITE_APP_ENV','VITE_API_BASE_URL']) previous[k] === undefined ? delete process.env[k] : process.env[k]=previous[k]; }
});
test('inventory mutations are album-specific and resettable', async () => {
 resetFixtures();
 await request('/stickers/me/duplicates',{method:'POST',body:{stickerId:1005,quantity:3}});
 assert.equal((await request('/stickers/me/duplicates?albumId=1')).find(s=>s.sticker_id===1005).quantity,3);
 assert.equal((await request('/stickers/me/duplicates?albumId=2')).find(s=>s.sticker_id===2005).quantity,2);
 await request('/stickers/me/needs/bulk',{method:'POST',body:{stickerIds:[2031,2032]}});
 assert.equal((await request('/stickers/me/needs?albumId=2')).length,20);
 resetFixtures(); assert.equal((await request('/stickers/me/needs?albumId=2')).length,18);
});
test('profile, notifications, and proposal counts satisfy UI contracts', async()=>{
 resetFixtures();
 assert.ok(Array.isArray((await request('/ratings/user/2')).recentRatings));
 assert.equal((await request('/swaps/stats/1')).name,'Alex Morgan');
 assert.equal((await request('/notifications')).unreadCount,1);
 const match=(await request('/swaps/matches?albumId=1'))[2];
 const preview=await request(`/swaps/preview/${match.id}`);
 const {swap}=await request('/swaps',{method:'POST',body:{matchId:match.id}});
 const detail=await request(`/swaps/${swap.id}`);
 assert.equal(detail.items.length,preview.aGivesB.length+preview.bGivesA.length);
});
test('swap actions and two message systems stay separate in fixtures',async()=>{
 resetFixtures();
 const accepted=await request('/swaps/1043/accept',{method:'POST'}); assert.equal(accepted.swap.status,'accepted');
 const posted=await request('/swaps/1042/posted',{method:'POST'}); assert.equal(posted.swap.user_a_posted,true); assert.equal(posted.swap.user_b_posted,false);
 await request('/swaps/1042/messages',{method:'POST',body:{body:'Swap-specific test'}});
 const direct=await request('/messages/21'); assert.ok(!direct.messages.some(m=>m.body==='Swap-specific test'));
 await assert.rejects(request('/unimplemented'),/No live request/);
 await assert.rejects(request('/push/register'),/disabled in preview/);
});
test('preview runtime blocks outgoing APIs before the app loads and separates storage',async()=>{
 const {runInNewContext}=await import('node:vm');
 const values=new Map([['authToken','live-token-sentinel']]);
 const context={window:{},navigator:{sendBeacon:()=>true,serviceWorker:{}},XMLHttpRequest:function(){},document:{addEventListener(){},documentElement:{dataset:{}}},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const code=readFileSync('src/runtime.js','utf8').replaceAll('import.meta.env.VITE_APP_ENV',"'preview'").replaceAll('import.meta.env.VITE_API_BASE_URL','undefined').replaceAll('export ','');
 runInNewContext(code+';preparePreview();',context);
 await assert.rejects(context.window.fetch('https://example.invalid'),/disabled/);
 assert.throws(()=>new context.XMLHttpRequest().open('GET','https://example.invalid'),/disabled/);
 assert.equal(context.navigator.sendBeacon(),false);
 assert.equal(context.window.open(),null);
 await assert.rejects(context.navigator.serviceWorker.register('/sw.js'),/disabled/);
 assert.equal(values.get('authToken'),'live-token-sentinel');
 assert.equal(values.get('gos-preview:authToken'),'preview-alex');
});
test('integration permits only the dedicated local API and never seeds demo credentials',async()=>{
 const {runInNewContext}=await import('node:vm');const values=new Map();const calls=[];
 const context={URL,location:{href:'http://127.0.0.1:5175/'},window:{fetch:async(...args)=>{calls.push(args);return 'local-response'}},navigator:{sendBeacon:()=>true,serviceWorker:{}},XMLHttpRequest:function(){},document:{addEventListener(){},documentElement:{dataset:{}}},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const code=readFileSync('src/runtime.js','utf8').replaceAll('import.meta.env.VITE_APP_ENV',"'integration'").replaceAll('import.meta.env.VITE_API_BASE_URL','undefined').replaceAll('export ','');runInNewContext(code+';preparePreview();',context);
 assert.equal(await context.window.fetch('http://127.0.0.1:3007/api/albums'),'local-response');
 for(const url of ['https://example.invalid/api','http://127.0.0.1:3000/api','http://127.0.0.1:3007/admin'])await assert.rejects(context.window.fetch(url),/disabled/);
 assert.equal(calls.length,1);assert.equal(values.size,0);
});
