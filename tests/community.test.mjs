import test from 'node:test';
import assert from 'node:assert/strict';
import {syncClubCatalog} from '../src/lib/community.ts';
import {syncStudentCopy} from '../src/lib/community.ts';
import {syncWallContent} from '../src/lib/community.ts';

test('club Wall content preserves edits and removals, credits sources, and does not duplicate posts',()=>{
 const s=seedWorld();
 for(const club of s.clubs){const posts=s.posts.filter(p=>p.club===club.id);assert.ok(posts.length>=1&&posts.length<=3);assert.ok(posts.every(p=>club.leaders.includes(p.author)))}
 assert.equal(s.posts.filter(p=>p.sourceUrl).length,16);
 delete s.wallContentVersion;s.posts.find(p=>p.id==='coffee').text='My own cafe review';
 const removed=s.posts.find(p=>p.id==='wall-tbo-games');s.posts=s.posts.filter(p=>p.id!==removed.id);s.removedPosts=[{post:removed,by:'sam',at:Date.now()}];
 const next=syncWallContent(s);
 assert.equal(next.posts.find(p=>p.id==='coffee').text,'My own cafe review');
 assert.equal(next.posts.some(p=>p.id===removed.id),false);
 assert.equal(new Set(next.posts.map(p=>p.id)).size,next.posts.length);
 assert.equal(syncWallContent(next),next);
});

test('student copy upgrade preserves edited content, removed samples, and discussion state',()=>{
 const old=seedWorld();delete old.studentCopyVersion;
 old.members.find(m=>m.id==='alex').bio='My own bio';
 old.members.find(m=>m.id==='maya').bio='Watercolors, late-night conversations, and a very full sketchbook. Say hi!';
 old.posts.find(p=>p.id==='coffee').text='My edited plan';
 old.posts.find(p=>p.id==='firstweek').comments[0].text='My edited reply';
 const removed=old.posts.find(p=>p.id==='student-robot');old.posts=old.posts.filter(p=>p.id!==removed.id);
 old.removedPosts=[{post:removed,by:'admin',at:Date.now()}];
 const before=structuredClone(old);
 const next=syncStudentCopy(old);
 assert.equal(next.members.find(m=>m.id==='alex').bio,'My own bio');
 assert.match(next.members.find(m=>m.id==='maya').bio,/Girl Up/);
 assert.equal(next.posts.find(p=>p.id==='coffee').text,'My edited plan');
 assert.equal(next.posts.find(p=>p.id==='firstweek').comments[0].text,'My edited reply');
 assert.equal(next.posts.some(p=>p.id==='student-robot'),false);
 assert.deepEqual(next.friends,old.friends);assert.deepEqual(next.requests,old.requests);
 assert.equal(syncStudentCopy(next),next);
 assert.deepEqual(old,before);
});

test('club catalog upgrade preserves follows and custom event edits and runs once',()=>{
 const old=seedWorld();delete old.clubCatalogVersion;
 old.clubs.find(c=>c.id==='cs').followers=['alex'];
 old.events[0].title='My edited event';old.events[0].demoDatePinned=true;
 old.posts.find(p=>p.id==='cs-post').text='My own announcement';
 const next=syncClubCatalog(old);
 assert.equal(next.clubs.length,8);
 assert.deepEqual(next.clubs.find(c=>c.id==='cs').followers,['alex']);
 assert.equal(next.events[0].title,'My edited event');
 assert.equal(next.posts.find(p=>p.id==='cs-post').text,'My own announcement');
 assert.equal(syncClubCatalog(next),next);
 assert.equal(old.clubCatalogVersion,undefined);
 assert.ok(next.clubs.every(c=>c.logo&&c.instagram));
});
import {seedWorld,applyAction,applyRequest,deliverReminders,eventStartMs,isFriend} from '../src/lib/community.ts';

test('polls validate choices and count a single changeable vote per member',()=>{
 let s=seedWorld();assert.throws(()=>applyAction(s,{type:'post',text:'When?',poll:['Friday',' friday '],tags:[]}),/different/);
 s=applyAction(s,{type:'post',text:'When?',poll:['Friday','Saturday'],tags:[]});const id=s.posts[0].id;
 s=applyAction(s,{type:'vote',post:id,option:0});s=applyAction(s,{type:'vote',post:id,option:1});assert.deepEqual(s.posts[0].poll.votes,{alex:1});
 assert.throws(()=>applyAction(s,{type:'vote',post:id,option:2}),/Choose one/);
 s=applyAction(s,{type:'switch',member:'maya'});s=applyAction(s,{type:'vote',post:id,option:0});assert.equal(Object.keys(s.posts[0].poll.votes).length,2);
 s=applyAction(s,{type:'vote',post:id,option:null});assert.deepEqual(s.posts[0].poll.votes,{alex:1});
});
test('Saved is private to each persona and supports posts and events',()=>{
 let s=seedWorld();s=applyAction(s,{type:'bookmark',kind:'post',target:'coffee',saved:true});s=applyAction(s,{type:'bookmark',kind:'event',target:'kickoff',saved:true});s=applyAction(s,{type:'bookmark',kind:'post',target:'coffee',saved:true});assert.equal(s.members[0].saved.length,2);
 s=applyAction(s,{type:'switch',member:'maya'});assert.equal(s.members.find(m=>m.id==='maya').saved,undefined);
 s=applyAction(s,{type:'bookmark',kind:'post',target:'coffee',saved:false});assert.equal(s.members[0].saved.length,2);
});
test('event changes notify Going and Interested members once with old and new details',()=>{
 let s=seedWorld();s=applyAction(s,{type:'switch',member:'sam'});const e=s.events[0];const fields={type:'saveEvent',id:e.id,club:e.club,title:e.title,date:e.date,time:'18:00',location:'New room',description:e.description};
 const before=s.notices.length;s=applyAction(s,fields);const notices=s.notices.slice(0,s.notices.length-before);
 assert.deepEqual(notices.map(n=>n.to).sort(),['alex','jordan','priya']);assert.ok(notices.every(n=>n.text.includes('17:00')&&n.text.includes('18:00')&&n.text.includes('New room')));
 const count=s.notices.length;s=applyAction(s,fields);assert.equal(s.notices.length,count);
});
test('reminders use Central Time, deliver once and follow a rescheduled event',()=>{
 assert.equal(new Date(eventStartMs({date:'2026-07-01',time:'17:00'})).toISOString(),'2026-07-01T22:00:00.000Z');
 assert.equal(new Date(eventStartMs({date:'2026-12-01',time:'17:00'})).toISOString(),'2026-12-01T23:00:00.000Z');
 const now=Date.parse('2026-09-20T12:00:00Z');let s=seedWorld(now);const start=eventStartMs(s.events[0]);
 s=applyAction(s,{type:'reminder',event:'kickoff',minutes:60},now);assert.equal(deliverReminders(s,start-3600001),s);
 s=deliverReminders(s,start-3600000);const count=s.notices.length;assert.equal(s.notices[0].to,'alex');assert.match(s.notices[0].text,/60 minutes/);assert.equal(deliverReminders(s,start-60000),s);
 s.events[0].time='18:00';s=deliverReminders(s,start);assert.equal(s.notices.length,count+1);
 s=applyAction(s,{type:'reminder',event:'kickoff',minutes:null},now);assert.equal(s.events[0].reminders.alex,undefined);
 assert.throws(()=>applyAction(s,{type:'reminder',event:'kickoff',minutes:60},start+7200000),/already started/);
});
test('lost-response retries do not duplicate a post or a message',()=>{
 let s=seedWorld();const request={action:{type:'post',text:'One post',tags:[]},version:s.version,requestId:'retry-post',actor:'alex'};
 s=applyRequest(s,request);const count=s.posts.length;s=applyRequest(s,request);assert.equal(s.posts.length,count);
 const message={action:{type:'message',member:'sam',text:'Once'},version:s.version,requestId:'retry-message',actor:'alex'};
 s=applyRequest(s,message);const messages=s.messages.length;s=applyRequest(s,message);assert.equal(s.messages.length,messages);
 assert.throws(()=>applyRequest(s,{...message,requestId:'different',actor:'maya'}),/account changed/);
});

test('mentions notify exact handles once, and editing remains author-only',()=>{
 let s=applyAction(seedWorld(),{type:'post',text:'Hi @mayanguyen and @mayanguyen!',tags:[]});const id=s.posts[0].id;
 assert.equal(s.notices.filter(n=>n.to==='maya'&&n.target===id).length,1);
 s=applyAction(s,{type:'editPost',post:id,text:'Hello @mayanguyen and @samkim'});
 assert.ok(s.posts[0].editedAt);assert.equal(s.notices.filter(n=>n.to==='maya'&&n.target===id).length,1);
 assert.equal(s.notices.filter(n=>n.to==='sam'&&n.target===id).length,1);
 s=applyAction(s,{type:'switch',member:'maya'});assert.throws(()=>applyAction(s,{type:'editPost',post:id,text:'Changed'}),/Only the author/);
 s=applyAction(s,{type:'comment',post:id,text:'Thanks @alexjohnson'});const comment=s.posts[0].comments[0].id;
 s=applyAction(s,{type:'editComment',post:id,comment,text:'Thanks @alexjohnson!'});assert.ok(s.posts[0].comments[0].editedAt);
 s=applyAction(s,{type:'switch',member:'alex'});assert.throws(()=>applyAction(s,{type:'editComment',post:id,comment,text:'Changed'}),/Only the author/);
});
test('undo restores the full post only for the remover and within the undo window',()=>{
 const original=seedWorld();let s=applyAction(original,{type:'post',text:'Photo',image:'data:image/png;base64,iVBORw0KGgo=',tags:[]},1000);const p=s.posts[0];
 s=applyAction(s,{type:'deletePost',post:p.id},2000);assert.equal(s.posts.some(x=>x.id===p.id),false);
 assert.throws(()=>applyAction({...s,actor:'maya'},{type:'restorePost',post:p.id},3000),/undo window/);
 assert.throws(()=>applyAction(s,{type:'restorePost',post:p.id},400000),/undo window/);
 s=applyAction(s,{type:'restorePost',post:p.id},3000);assert.deepEqual(s.posts.find(x=>x.id===p.id),p);
 assert.throws(()=>applyAction(s,{type:'restorePost',post:p.id},4000),/undo window/);
});
test('onboarding, event welcome fields and photo collections work with legacy data',()=>{
 let s=seedWorld();s=applyAction(s,{type:'onboard',interests:['Art','Art','Coding']});assert.deepEqual(s.members[0].interests,['Art','Coding']);assert.equal(s.members[0].onboarded,true);
 s=applyAction(s,{type:'switch',member:'sam'});const e=s.events[0];
 s=applyAction(s,{type:'saveEvent',id:e.id,club:e.club,title:e.title,date:e.date,time:e.time,location:e.location,description:e.description,beginnersWelcome:true,arrivalHost:'sam',arrivalNote:'By the entrance'});
 assert.equal(s.events[0].beginnersWelcome,true);assert.equal(s.events[0].arrivalHost,'sam');
 s=applyAction(s,{type:'post',text:'Great evening',event:e.id,image:'data:image/png;base64,iVBORw0KGgo=',tags:[]});assert.equal(s.posts[0].event,e.id);
 assert.throws(()=>applyAction(s,{type:'saveEvent',id:e.id,club:e.club,title:e.title,date:e.date,time:e.time,location:e.location,description:e.description,arrivalHost:'missing'}),/Member not found/);
});
test('friend requests require acceptance, unlock messages, and preserve the original state',()=>{
 const original=seedWorld();let s=applyAction(original,{type:'request',member:'priya'});
 assert.equal(original.requests.some(r=>r.to==='priya'),false);
 assert.throws(()=>applyAction(s,{type:'message',member:'priya',text:'Hello'}),/Become friends/);
 s=applyAction(s,{type:'switch',member:'priya'});s=applyAction(s,{type:'respondRequest',member:'alex',accept:true});
 assert.ok(isFriend(s,'alex','priya'));s=applyAction(s,{type:'message',member:'alex',text:'Hello Alex'});
 assert.equal(s.messages.at(-1).read,false);s=applyAction(s,{type:'switch',member:'alex'});s=applyAction(s,{type:'readMessages',member:'priya'});assert.equal(s.messages.at(-1).read,true);
});
test('club event creation and editing requires the correct assigned leader',()=>{
 let s=seedWorld();const fields={type:'saveEvent',club:'cs',title:'Test get-together',date:s.day,time:'17:00',location:'Commons',description:'A demo event'};
 assert.throws(()=>applyAction(s,fields),/Only assigned/);s=applyAction(s,{type:'switch',member:'maya'});assert.throws(()=>applyAction(s,fields),/Only assigned/);
 s=applyAction(s,{type:'switch',member:'sam'});s=applyAction(s,fields);const event=s.events.at(-1);assert.equal(event.club,'cs');
 assert.throws(()=>applyAction(s,{...fields,id:event.id,club:'art'}),/host cannot/);
 s=applyAction(s,{type:'saveEvent',...fields,id:event.id,title:'Updated title'});assert.equal(s.events.at(-1).title,'Updated title');
});
test('pokes allow one outstanding poke, and photo tags require approval',()=>{
 let s=seedWorld();s=applyAction(s,{type:'poke',member:'maya'});assert.throws(()=>applyAction(s,{type:'poke',member:'maya'}),/Wait for a poke back/);
 s=applyAction(s,{type:'post',text:'Photo moment',image:'data:image/png;base64,iVBORw0KGgo=',tags:['maya']});const id=s.posts[0].id;assert.equal(s.posts[0].tags[0].approved,false);
 assert.throws(()=>applyAction(s,{type:'tag',post:id,accept:true}),/not found/);s=applyAction(s,{type:'switch',member:'maya'});s=applyAction(s,{type:'tag',post:id,accept:true});assert.equal(s.posts[0].tags[0].approved,true);
 s=applyAction(s,{type:'tag',post:id,accept:false});assert.equal(s.posts[0].tags.length,0);
});
test('moderation and Wall permissions are enforced independently of the UI',()=>{
 let s=seedWorld();assert.throws(()=>applyAction(s,{type:'deletePost',post:'coffee'}),/only remove/);assert.throws(()=>applyAction(s,{type:'post',text:'Hello',tags:[],wall:'priya'}),/friend/);
 s=applyAction(s,{type:'report',post:'coffee',reason:'Review demonstration'});const report=s.reports[0].id;assert.throws(()=>applyAction(s,{type:'resolveReport',report,remove:true}),/Only community admins/);
 s=applyAction(s,{type:'switch',member:'admin'});s=applyAction(s,{type:'resolveReport',report,remove:true});assert.equal(s.posts.some(p=>p.id==='coffee'),false);
});

test('calendar refresh moves sample events together and preserves edited or created dates',async()=>{
 const {syncDemoDay,localDay}=await import('../src/lib/community.ts');
 let s=seedWorld(Date.parse('2026-09-12T17:00:00Z'));
 s.events.find(e=>e.id==='artnight').demoDatePinned=true;
 s.events.push({...s.events[0],id:'custom',date:'2026-10-15'});
 const next=syncDemoDay(s,'2026-09-27');
 assert.equal(next.day,'2026-09-27');assert.equal(next.events[0].date,'2026-09-29');
 assert.equal(next.events.find(e=>e.id==='welcome').date,'2026-10-03');
 assert.equal(next.events.find(e=>e.id==='artnight').date,'2026-09-16');
 assert.equal(next.events.find(e=>e.id==='custom').date,'2026-10-15');
 assert.equal(syncDemoDay(next,'2026-09-27'),next);
 assert.equal(syncDemoDay(next,'2026-02-30'),next);
 assert.equal(syncDemoDay(next,'2027-01-01').events[0].date,'2027-01-03');
 assert.equal(s.day,'2026-09-12');
 assert.equal(localDay(new Date(2026,8,27,0,1)),'2026-09-27');
 const legacy=seedWorld(Date.parse('2026-09-12T17:00:00Z'));legacy.events[0].date='2026-10-20';
 assert.equal(syncDemoDay(legacy,'2026-09-27').events[0].date,'2026-10-20');
});
