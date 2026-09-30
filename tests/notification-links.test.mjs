import test from 'node:test';
import assert from 'node:assert/strict';
import { splitNotificationLinks, surveyIdFromLink } from '../src/notificationLinks.js';
test('notification links preserve text and allow only absolute web URLs',()=>{
 const text='Survey: https://forms.gle/HKnij9A54CbzTQM69. Then https://example.com?q=1&b=2';
 const parts=splitNotificationLinks(text);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),['https://forms.gle/HKnij9A54CbzTQM69','https://example.com/?q=1&b=2']);
 for(const text of ['javascript:alert(1)','data:text/html,test','https://user:password@example.com','https://']) assert.equal(splitNotificationLinks(text).some(p=>p.href),false);
});

test('survey links route only trusted app URLs',()=>{assert.equal(surveyIdFromLink('https://www.gotonespare.com/?survey=12'),'12');for(const u of ['https://gotonespare.com.evil.test/?survey=1','https://forms.gle/HKnij9A54CbzTQM69','https://gotonespare.com/?survey=no','http://gotonespare.com/?survey=1'])assert.equal(surveyIdFromLink(u),null);});
