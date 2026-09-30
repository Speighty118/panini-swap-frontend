import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseIdentity} from '../src/purchaseIdentity.js';
test('switching accounts uses login and invalidates previous purchase actions',async()=>{
 const calls=[];const client=createPurchaseIdentity({configure:async x=>calls.push(['configure',x.appUserID]),logIn:async x=>calls.push(['login',x.appUserID])},'public');
 await client.select(1);await client.assert(1);await client.select(2);await assert.rejects(client.assert(1));await client.assert(2);client.clear();await assert.rejects(client.assert(2));await client.select(1);assert.deepEqual(calls,[['configure','1'],['login','2'],['login','1']]);
 await assert.rejects(client.select('1junk'));
});
test('failed account switching cannot authorize a purchase for the new account',async()=>{
 const client=createPurchaseIdentity({configure:async()=>{},logIn:async()=>{throw Error('offline')}},'public');await client.select(1);await assert.rejects(client.select(2));await assert.rejects(client.assert(2));
});
