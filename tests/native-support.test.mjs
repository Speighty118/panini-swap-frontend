import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSupport,SUPPORT_PRODUCTS} from '../src/nativeSupport.js';
test('native support isolates identity, uses store prices, and restores Founder only',async()=>{
 let configs=[],paid=[],restoreInfo={entitlements:{active:{}}};
 const sdk={configure:async c=>configs.push(c),getProducts:async()=>({products:[{identifier:SUPPORT_PRODUCTS[3],priceString:'£3.00'},{identifier:SUPPORT_PRODUCTS.founder,priceString:'£14.99'}]}),purchaseStoreProduct:async({product})=>{paid.push(product.identifier);return {customerInfo:{entitlements:{active:{founder:{}}}}}},restorePurchases:async()=>({customerInfo:restoreInfo})};
 assert.throws(()=>createNativeSupport({purchases:sdk,userId:'123'}),/sandbox identity/);
 const client=createNativeSupport({purchases:sdk,apiKey:'public-test-key',userId:'support-sandbox-00000000-0000-0000-0000-000000000001'});
 const prices=await client.load();assert.equal(prices[3],'£3.00');assert.equal(prices[5],null);
 await assert.rejects(()=>client.purchase('5'),/not available/);await client.purchase('3');await client.purchase('founder');
 assert.deepEqual(paid,[SUPPORT_PRODUCTS[3],SUPPORT_PRODUCTS.founder]);assert.equal(configs.length,1);
 assert.equal(await client.restore(),false);restoreInfo={entitlements:{active:{founder:{}}}};assert.equal(await client.restore(),true);
});
test('native purchase cancellation and concurrent taps never start another charge',async()=>{
 let release,count=0;
 const client=createNativeSupport({apiKey:'public-test-key',userId:'support-sandbox-00000000-0000-0000-0000-000000000001',purchases:{configure:async()=>{},getProducts:async()=>({products:[{identifier:SUPPORT_PRODUCTS[3],priceString:'£3.00'}]}),purchaseStoreProduct:async()=>{count++;await new Promise(r=>release=r);throw Object.assign(new Error('Cancelled'),{userCancelled:true});}}});
 await client.load();const first=client.purchase('3');await new Promise(r=>setImmediate(r));await assert.rejects(()=>client.purchase('3'),/already in progress/);release();await assert.rejects(first,e=>e.userCancelled);assert.equal(count,1);
});
test('signed-in support uses current account and rejects a changed account before checkout',async()=>{
 let current=42,paid=0;const account={select:async id=>{current=id},assert:async id=>{if(id!==current)throw Error('account changed')}};
 const sdk={getProducts:async()=>({products:[{identifier:SUPPORT_PRODUCTS[3],priceString:'£3.00'}]}),purchaseStoreProduct:async()=>{paid++;return {}},restorePurchases:async()=>({customerInfo:{entitlements:{active:{founder:{}}}}})};
 const client=createNativeSupport({purchases:sdk,userId:42,account});await client.load();await client.purchase('3');assert.equal(paid,1);assert.equal(await client.restore(),true);
 current=99;await assert.rejects(client.purchase('3'),/account changed/);assert.equal(paid,1);
 assert.throws(()=>createNativeSupport({purchases:sdk,userId:'42wrong',account}));
});
