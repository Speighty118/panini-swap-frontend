// Checkout orchestration is separate from preview UI and native purchasing.
export function createSupportCheckout({request,storage,randomUUID,navigate,native=false}) {
 return async ({amount,userId,token})=>{
  if(native)throw new Error('Please use the App Store purchase option on iPhone.');
  if(![300,500,1000].includes(amount))throw new Error('Choose £3, £5 or £10.');
  const key=`support-attempt:${userId}`;
  let attempt;try{attempt=JSON.parse(storage.getItem(key));}catch{}
  if(!attempt || attempt.amount!==amount || !/^[a-f0-9-]{36}$/i.test(attempt.id) || Date.now()-attempt.created>30*60*1000){
   attempt={id:randomUUID(),amount,created:Date.now()};storage.setItem(key,JSON.stringify(attempt));
  }
  const result=await request('/support/checkout',{method:'POST',token,body:{amount,attemptId:attempt.id}});
  const url=new URL(result.url);
  if(url.protocol!=='https:' || url.hostname!=='checkout.stripe.com' || url.username || url.password)throw new Error('Unable to open secure checkout. Please try again.');
  navigate(url.href);
 };
}
