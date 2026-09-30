import test from 'node:test';import assert from 'node:assert/strict';
import {createSupportCheckout} from '../src/supportPayments.js';
test('support checkout isolates native, validates destinations and reuses only the same attempt',async()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 let n=0, calls=[],destination='';
 const options={storage,randomUUID:()=>`00000000-0000-0000-0000-${String(++n).padStart(12,'0')}`,request:async(p,o)=>{calls.push(o.body);return{url:'https://checkout.stripe.com/c/pay/test'};},navigate:u=>destination=u};
 const checkout=createSupportCheckout(options);
 await checkout({amount:300,userId:1});await checkout({amount:300,userId:1});assert.equal(calls[0].attemptId,calls[1].attemptId);
 await checkout({amount:500,userId:1});assert.notEqual(calls[1].attemptId,calls[2].attemptId);
 await checkout({amount:500,userId:2});assert.notEqual(calls[2].attemptId,calls[3].attemptId);
 assert.equal(destination,'https://checkout.stripe.com/c/pay/test');
 await assert.rejects(()=>checkout({amount:1,userId:1}));
 await assert.rejects(()=>createSupportCheckout({...options,native:true})({amount:300,userId:1}));
 for(const url of ['http://checkout.stripe.com/','https://evil.test/','https://checkout.stripe.com.evil.test/','https://user:pass@checkout.stripe.com/'])await assert.rejects(()=>createSupportCheckout({...options,request:async()=>({url})})({amount:300,userId:1}));
});
