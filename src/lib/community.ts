import { z } from "zod";
import { syncWallContent } from "./wall-content.ts";
export { syncWallContent } from "./wall-content.ts";
import { clubCatalog } from "./club-catalog.ts";
import { syncStudentCopy } from "./student-copy.ts";
export { syncStudentCopy } from "./student-copy.ts";

export type Member = { id:string; name:string; year:string; role:"student"|"alumni"|"organizer"|"admin"; bio:string; interests:string[]; music:string; books:string; color:string; birthday:string; birthdayVisible:boolean; onboarded?:boolean; saved?:{kind:"post"|"event";target:string;at:number}[]; photo?:string };
export type Club = { logo?:string; instagram?:string; brandColor?:string; id:string; name:string; short:string; category:string; description:string; leaders:string[]; followers:string[]; color:string };
export type Comment = { id:string; author:string; text:string; at:number; replyTo?:string; editedAt?:number };
export type Event = { demoDatePinned?:boolean; id:string; club?:string; title:string; date:string; time:string; location:string; description:string; creator:string; beginnersWelcome?:boolean; arrivalHost?:string; arrivalNote?:string; rsvps:Record<string,"going"|"interested">; comments:Comment[]; reminders?:Record<string,{minutes:number;sentFor?:string}> };
export type Post = { sourceUrl?:string; poll?:{options:string[];votes:Record<string,number>}; editedAt?:number; id:string; author:string; text:string; at:number; wall?:string; club?:string; event?:string; image?:string; tags:{member:string;approved:boolean}[]; likes:string[]; comments:Comment[] };
export type Notice = { id:string; to:string; text:string; kind:"profile"|"post"|"event"|"messages"|"tags"|"requests"; target:string; read:boolean; at:number };
export type World = { wallContentVersion?:number; eventTitlesVersion?:number; studentCopyVersion?:number; clubCatalogVersion?:number; receipts?:{id:string;actor:string}[]; removedPosts?:{post:Post;by:string;at:number}[]; version:number; actor:string; day:string; members:Member[]; clubs:Club[]; events:Event[]; posts:Post[]; friends:string[]; requests:{from:string;to:string}[]; pokes:{from:string;to:string}[]; messages:{id:string;from:string;to:string;text:string;at:number;read:boolean}[]; notices:Notice[]; reports:{id:string;by:string;post:string;reason:string;resolved:boolean}[] };
export const pair = (a:string,b:string) => [a,b].sort().join(":");
export const isFriend = (s:World,a:string,b:string) => s.friends.includes(pair(a,b));
export const canManageEvent = (s:World, actor:string, event:Pick<Event,"club"|"creator">) => event.club ? !!s.clubs.find(c=>c.id===event.club)?.leaders.includes(actor) : ["organizer","admin"].includes(s.members.find(m=>m.id===actor)?.role??"");
export const uid = () => crypto.randomUUID();
// Event times are campus-local, independent of the viewer's timezone.
export function eventStartMs(event:Pick<Event,"date"|"time">):number {
 const desired=Date.parse(`${event.date}T${event.time}:00Z`);let instant=desired;
 const format=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
 for(let i=0;i<3;i++){const parts=Object.fromEntries(format.formatToParts(instant).map(p=>[p.type,p.value]));const local=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);const delta=desired-local;if(!delta)break;instant+=delta}
 return instant;
}
export function deliverReminders(original:World,now=Date.now()):World {
 let next:World|undefined;
 for(const event of original.events){const start=eventStartMs(event);const stamp=`${event.date}T${event.time}`;
  for(const [member,reminder] of Object.entries(event.reminders??{})){
   if(now<start-reminder.minutes*60000||now>start+3600000||reminder.sentFor===stamp)continue;
   next??=structuredClone(original);next.events.find(e=>e.id===event.id)!.reminders![member].sentFor=stamp;
   const minutes=Math.ceil((start-now)/60000);const when=minutes>60?`in about ${Math.round(minutes/60)} hours`:minutes>1?`in ${minutes} minutes`:minutes>0?"in a minute":minutes===0?"just now":`${Math.abs(minutes)} minutes ago`;
   next.notices.unshift({id:uid(),to:member,text:`Reminder: ${event.title} ${minutes>0?"starts":"started"} ${when} · ${event.location}`,kind:"event",target:event.id,read:false,at:now});
  }
 }
 if(!next)return original;next.version++;next.notices=next.notices.slice(0,1000);return next;
}
// A retry after a lost response must not post, message or toggle twice.
export function applyRequest(original:World,request:{action:unknown;version:number;requestId?:string;actor?:string},now=Date.now()):World {
 if(request.requestId&&original.receipts?.some(r=>r.id===request.requestId&&r.actor===request.actor))return original;
 if(request.actor&&request.actor!==original.actor)throw new Error("Your active demo account changed. Review your draft before trying again.");
 if(request.version!==original.version)throw new Error("Your demo changed. The latest version is loaded; please try again.");
 const next=applyAction(original,request.action,now);
 if(request.requestId)next.receipts=[...(next.receipts??[]),{id:request.requestId,actor:original.actor}].slice(-200);
 return next;
}
// Advance only untouched fictional sample dates; real edits retain their chosen schedule.
export function localDay(now=new Date()):string { return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-") }
export function syncDemoDay(original:World,day:string):World {
 original=syncWallContent(syncEventTitles(syncStudentCopy(syncClubCatalog(original))));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+"T12:00:00Z"))||new Date(day+"T12:00:00Z").toISOString().slice(0,10)!==day||day===original.day)return original;
 const shift=(value:string,days:number)=>new Date(Date.parse(value+"T12:00:00Z")+days*86400000).toISOString().slice(0,10);
 const offsets:Record<string,number>={kickoff:2,artnight:4,welcome:6,robotlab:8,jam:10};
 const next=structuredClone(original);
 for(const e of next.events){const offset=offsets[e.id];if(offset===undefined||e.demoDatePinned)continue;if(e.date!==shift(original.day,offset)){e.demoDatePinned=true;continue}e.date=shift(day,offset);for(const r of Object.values(e.reminders??{}))delete r.sentFor}
 next.day=day;next.version++;return next;
}

// Upgrade catalog metadata without resetting follows, drafts, or authored activity.
export function syncClubCatalog(original:World):World {
 if(original.clubCatalogVersion===2)return original;
 const next=structuredClone(original);
 next.clubs=clubCatalog.map(c=>({...c,leaders:[],followers:[],...next.clubs.find(old=>old.id===c.id),...c}));
 const examples:Record<string,[string,string,string]>={
 kickoff:["CS Club kick-off","TBO idea exchange","Bring an idea or a question about entrepreneurship. Meet other students and explore what you could build together."],
 artnight:["An evening of art","Girl Up welcome evening","Meet other students interested in advocacy and service. Share ideas for a community project and learn how to get involved."],
 jam:["Open jam session","Student Council community night","Bring a friend or come on your own for games, conversation, and ideas for making campus life better."]
 };
 for(const e of next.events){const change=examples[e.id];if(change&&e.title===change[0]&&!e.demoDatePinned){e.title=change[1];e.description=change[2]}}
 const post=next.posts.find(p=>p.id==="cs-post");
 if(post&&!post.editedAt&&post.text==="New faces, new ideas. Our first CS Club meet-up is coming up! You don’t need to know how to code. Just come curious.")post.text="Have an idea you’d like to try? Come to the TBO idea exchange. You don’t need a business plan—just bring your curiosity.";
 const sam=next.members.find(m=>m.id==="sam");
 if(sam?.bio==="CS Club lead. Happy to help you get your first project off the ground.")sam.bio="Interested in coding and entrepreneurship. Happy to help you get your first project off the ground.";
 const msg=next.messages.find(m=>m.id==="m1");
 if(msg?.text==="Hey Alex! Saw you’re interested in the CS kick-off. Anything you’re excited to build?")msg.text="Hey Alex! Saw you’re interested in the TBO idea exchange. Anything you’re excited to build?";
 next.clubCatalogVersion=2;next.version++;return next;
}


// Normalize untouched sample event titles once; organizers retain their edits.
export function syncEventTitles(original:World):World {
 if(original.eventTitlesVersion===1)return original;
 const next=structuredClone(original);
 const titles:Record<string,[string,string]>={kickoff:["TBO idea exchange","TBO Idea Exchange"],artnight:["Girl Up welcome evening","Girl Up Welcome Evening"],welcome:["TAMS community picnic","TAMS Community Picnic"],robotlab:["Build your first robot","Robotics Intro Workshop"],jam:["Student Council community night","Student Council Community Night"]};
 for(const e of next.events){const change=titles[e.id];if(change&&!e.demoDatePinned&&e.title===change[0])e.title=change[1]}
 next.eventTitlesVersion=1;next.version++;return next;
}
export function eventPreview(description:string):string {
 const text=description.replace(/\s+/g," ").trim();
 const sentences=(text.match(/[^.!?]+[.!?](?:\s|$)/g)??[]).map(s=>s.trim());
 if(sentences.length&&sentences[0].length<=170){const firstTwo=sentences.slice(0,2).join(" ");return firstTwo.length<=170?firstTwo:sentences[0]}
 if(text.length<=170)return text;
 const cut=text.lastIndexOf(" ",167);return text.slice(0,cut>80?cut:167).replace(/[.,;:]$/,"")+"…";
}

export function seedWorld(now = Date.now()):World {
 const day = new Date(now).toISOString().slice(0,10);
 const date = (offset:number) => new Date(now + offset*86400000).toISOString().slice(0,10);
 const members:Member[] = [
  {id:"alex",name:"Alex Johnson",year:"2028",role:"student",bio:"New to TAMS. Building things, finding good coffee, and making this place feel like home.",interests:["Coding","Photography","Music"],music:"Indie playlists on repeat",books:"The Martian",color:"green",birthday:"04-18",birthdayVisible:false},
  {id:"maya",name:"Maya Nguyen",year:"2028",role:"student",bio:"Watercolors, late-night conversations, and a very full sketchbook. Say hi!",interests:["Art","Photography","Music"],music:"Laufey",books:"The Little Prince",color:"peach",birthday:day.slice(5),birthdayVisible:true},
  {id:"sam",name:"Sam Kim",year:"2027",role:"student",bio:"CS Club lead. Happy to help you get your first project off the ground.",interests:["Coding","Robotics","Coffee"],music:"Jazz while I code",books:"Project Hail Mary",color:"blue",birthday:"10-09",birthdayVisible:true},
  {id:"priya",name:"Priya Shah",year:"2028",role:"student",bio:"Usually thinking about space or trying a new recipe.",interests:["Coding","Astronomy","Cooking"],music:"Film soundtracks",books:"Cosmos",color:"lilac",birthday:"01-16",birthdayVisible:false},
  {id:"jordan",name:"Jordan Rivera",year:"2027",role:"student",bio:"Robotics, climbing, and an unreasonable number of side projects.",interests:["Robotics","Coding","Outdoors"],music:"Alternative rock",books:"Dune",color:"sand",birthday:"05-22",birthdayVisible:true},
  {id:"eli",name:"Eli Chen",year:"2028",role:"student",bio:"Always down for a board game. Currently learning guitar.",interests:["Music","Board games","Art"],music:"Acoustic guitar",books:"The Hobbit",color:"rose",birthday:"07-04",birthdayVisible:true},
  {id:"nora",name:"Nora Patel",year:"2024",role:"alumni",bio:"TAMS alum studying computer science. Happy to share what helped me navigate research and college.",interests:["Coding","Research","Running"],music:"A little of everything",books:"Algorithms to Live By",color:"blue",birthday:"03-12",birthdayVisible:false},
  {id:"leo",name:"Leo Martinez",year:"2027",role:"student",bio:"Looking for new trails and people to explore them with.",interests:["Outdoors","Photography","Astronomy"],music:"Indie folk",books:"A Walk in the Woods",color:"green",birthday:"11-26",birthdayVisible:true},
  {id:"organizer",name:"Taylor Brooks",year:"",role:"organizer",bio:"Fictional TAMS event organizer for this prototype.",interests:["Community"],music:"",books:"",color:"sand",birthday:"",birthdayVisible:false},
  {id:"admin",name:"Community Admin",year:"",role:"admin",bio:"Fictional moderation account. Use the demo controls to explore the community tools.",interests:[],music:"",books:"",color:"green",birthday:"",birthdayVisible:false}
 ];
 const clubs:Club[] = [
  {id:"cs",name:"Computer Science",short:"CS",category:"Science & tech",description:"Make something together. Bring your curiosity, your half-finished project, or just yourself. All experience levels welcome.",leaders:["sam"],followers:["alex","sam","priya","jordan","nora"],color:"green"},
  {id:"art",name:"Art & Creativity",short:"AC",category:"Arts & culture",description:"A space to draw, paint, experiment, and share. No portfolio needed—just a willingness to try something new.",leaders:["maya"],followers:["alex","maya","eli"],color:"plum"},
  {id:"robotics",name:"Robotics",short:"RB",category:"Science & tech",description:"From first circuits to autonomous robots. Design, build, and solve problems as a team.",leaders:["jordan"],followers:["sam","jordan","priya"],color:"blue"},
  {id:"outdoors",name:"Outdoor Adventures",short:"OA",category:"Recreation",description:"Fresh air and good company. Easy walks, weekend adventures, and a reason to close your laptop.",leaders:["leo"],followers:["leo","jordan"],color:"sand"},
  {id:"music",name:"Music Collective",short:"MC",category:"Arts & culture",description:"Find your next jam partner. Listeners, beginners, and experienced musicians are all welcome.",leaders:["eli"],followers:["eli","maya","alex"],color:"rose"},
  {id:"astronomy",name:"Astronomy Society",short:"AS",category:"Science & tech",description:"Look up with us. Stargazing, space conversations, and exploring the universe together.",leaders:["priya"],followers:["priya","leo"],color:"lilac"}
 ];
 const events:Event[] = [
  {id:"kickoff",club:"cs",title:"CS Club kick-off",date:date(2),time:"17:00",location:"McConnell Hall · Commons",description:"Meet the people behind the projects. We’ll introduce the club, swap ideas, and build something small together. Bring a laptop if you have one. Beginners welcome!",creator:"sam",rsvps:{sam:"going",priya:"going",jordan:"going",alex:"interested"},comments:[]},
  {id:"artnight",club:"art",title:"An evening of art",date:date(4),time:"18:30",location:"McConnell Hall · Commons",description:"A relaxed evening of drawing, painting, and getting to know each other. Supplies provided; bring your favorite playlist.",creator:"maya",rsvps:{maya:"going",eli:"going"},comments:[]},
  {id:"welcome",title:"TAMS community picnic",date:date(6),time:"12:00",location:"Campus green",description:"A chance for students and alumni to catch up, meet someone new, and enjoy lunch together. This is a fictional demonstration event.",creator:"organizer",rsvps:{alex:"going",maya:"going",nora:"interested",leo:"going"},comments:[]},
  {id:"robotlab",club:"robotics",title:"Build your first robot",date:date(8),time:"16:00",location:"Robotics meeting room",description:"A hands-on introduction to circuits, sensors, and the small victories of getting a robot to move. No experience needed.",creator:"jordan",rsvps:{jordan:"going",sam:"interested"},comments:[]},
  {id:"jam",club:"music",title:"Open jam session",date:date(10),time:"19:00",location:"McConnell Hall · Commons",description:"Bring an instrument or just come listen. We’ll start with a few easy songs and see where the evening goes.",creator:"eli",rsvps:{eli:"going"},comments:[]}
 ];
 return {...syncWallContent(syncEventTitles(syncStudentCopy(syncClubCatalog({version:0,actor:"alex",day,members,clubs,events,friends:[pair("alex","maya"),pair("alex","sam"),pair("maya","eli"),pair("sam","jordan"),pair("sam","priya"),pair("nora","sam")],requests:[{from:"eli",to:"alex"}],pokes:[{from:"maya",to:"alex"}],
  posts:[
   {id:"coffee",author:"maya",text:"Anyone up for a weekend coffee run? Thinking 10 tomorrow, then we can explore campus. ☕",at:now-40*60000,tags:[],likes:["sam","eli","leo"],comments:[{id:"c1",author:"sam",text:"Count me in. Much-needed fuel for my project!",at:now-20*60000}]},
   {id:"cs-post",author:"sam",club:"cs",event:"kickoff",text:"New faces, new ideas. Our first CS Club meet-up is coming up! You don’t need to know how to code. Just come curious.",at:now-90*60000,tags:[],likes:["maya","priya","jordan","nora"],comments:[]},
   {id:"firstweek",author:"eli",text:"First week of TAMS: survived. Already found my favorite study spot and approximately zero matching socks. What’s one thing you’re glad you brought?",at:now-3*3600000,tags:[],likes:["maya","leo"],comments:[{id:"c2",author:"maya",text:"A really good blanket. Non-negotiable.",at:now-2*3600000}]},
   {id:"alumhello",author:"nora",text:"Hey everyone, TAMS ’24 here! Starting somewhere new can be a lot. If you want to hear about research, college life, or finding your people, I’m happy to chat.",at:now-6*3600000,tags:[],likes:["sam","maya","priya"],comments:[]}
  ],messages:[{id:"m1",from:"sam",to:"alex",text:"Hey Alex! Saw you’re interested in the CS kick-off. Anything you’re excited to build?",at:now-3600000,read:false}],notices:[{id:"n1",to:"alex",text:"Eli Chen sent you a friend request.",kind:"requests",target:"eli",read:false,at:now-1800000},{id:"n2",to:"alex",text:"Maya Nguyen poked you.",kind:"profile",target:"maya",read:false,at:now-500000}],reports:[]} as World)))),version:0};
}

const id=z.string().min(1).max(100);
const body=z.string().trim().min(1).max(3000);
const imagePath=z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(7 * 1024 * 1024);
const eventFields={beginnersWelcome:z.boolean().optional(),arrivalHost:id.optional(),arrivalNote:z.string().trim().max(200).optional(),club:id.optional(),title:z.string().trim().min(1).max(100),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),location:z.string().trim().min(1).max(150),description:body};
export const actionSchema=z.discriminatedUnion("type",[
 z.object({type:z.literal("switch"),member:id}),
 z.object({type:z.literal("bookmark"),kind:z.enum(["post","event"]),target:id,saved:z.boolean()}),
 z.object({type:z.literal("vote"),post:id,option:z.number().int().min(0).max(3).nullable()}),
 z.object({type:z.literal("reminder"),event:id,minutes:z.union([z.literal(15),z.literal(60),z.literal(1440)]).nullable()}),
 z.object({type:z.literal("onboard"),interests:z.array(z.string().trim().min(1).max(30)).max(8).optional()}),
 z.object({type:z.literal("editPost"),post:id,text:z.string().trim().max(3000)}),
 z.object({type:z.literal("editComment"),post:id.optional(),event:id.optional(),comment:id,text:body}),
 z.object({type:z.literal("restorePost"),post:id}),
 z.object({type:z.literal("post"),poll:z.array(z.string().trim().min(1).max(100)).min(2).max(4).optional(),text:z.string().trim().max(3000),image:imagePath.optional(),tags:z.array(id).max(8).default([]),wall:id.optional(),club:id.optional(),event:id.optional()}),
 z.object({type:z.literal("like"),post:id}),
 z.object({type:z.literal("comment"),post:id.optional(),event:id.optional(),text:body,replyTo:id.optional()}),
 z.object({type:z.literal("deletePost"),post:id}),
 z.object({type:z.literal("request"),member:id}),
 z.object({type:z.literal("respondRequest"),member:id,accept:z.boolean()}),
 z.object({type:z.literal("cancelRequest"),member:id}),
 z.object({type:z.literal("poke"),member:id}),
 z.object({type:z.literal("follow"),club:id}),
 z.object({type:z.literal("message"),member:id,text:body}),
 z.object({type:z.literal("readMessages"),member:id}),
 z.object({type:z.literal("readNotices"),notice:id.optional()}),
 z.object({type:z.literal("rsvp"),event:id,status:z.enum(["going","interested","none"])}),
 z.object({type:z.literal("saveEvent"),id:id.optional(),...eventFields}),
 z.object({type:z.literal("profile"),bio:z.string().trim().max(500),interests:z.array(z.string().trim().min(1).max(30)).max(8),music:z.string().max(120),books:z.string().max(120),birthday:z.string().regex(/^(|\d{2}-\d{2})$/),birthdayVisible:z.boolean(),photo:imagePath.optional()}),
 z.object({type:z.literal("tag"),post:id,accept:z.boolean()}),
 z.object({type:z.literal("report"),post:id,reason:z.string().trim().min(1).max(500)}),
 z.object({type:z.literal("resolveReport"),report:id,remove:z.boolean()}),
 z.object({type:z.literal("assignLeader"),club:id,member:id,add:z.boolean()})
]);
export type Action = z.infer<typeof actionSchema>;
function ensure(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message)}
export function applyAction(original:World,input:unknown,now=Date.now()):World {
 const a=actionSchema.parse(input); const s=structuredClone(original); const me=s.members.find(m=>m.id===s.actor)!;
 const notify=(to:string,text:string,kind:Notice["kind"],target:string)=>{if(to!==me.id)s.notices.unshift({id:uid(),to,text,kind,target,read:false,at:now})};
 const person=(target:string)=>{const m=s.members.find(m=>m.id===target);if(!m)throw new Error("Member not found.");return m};
 const post=(target:string)=>{const p=s.posts.find(p=>p.id===target);if(!p)throw new Error("This post is no longer available.");return p};
 const event=(target:string)=>{const e=s.events.find(e=>e.id===target);if(!e)throw new Error("Event not found.");return e};
 const mentions=(text:string,kind:Notice["kind"],target:string,previous="")=>{for(const m of s.members){const handle="@"+m.name.toLowerCase().replace(/[^a-z0-9]/g,"");const has=(v:string)=>v.toLowerCase().split(/[^a-z0-9@]+/).includes(handle);if(has(text)&&!has(previous))notify(m.id,me.name+" mentioned you: "+text.slice(0,120),kind,target)}};
 switch(a.type){
  case "bookmark": {if(a.saved){a.kind==="post"?post(a.target):event(a.target);ensure((me.saved?.length??0)<500||me.saved?.some(x=>x.kind===a.kind&&x.target===a.target),"Your Saved list is full.")}me.saved=(me.saved??[]).filter(x=>x.kind!==a.kind||x.target!==a.target);if(a.saved)me.saved.unshift({kind:a.kind,target:a.target,at:now});break}
  case "vote": {const p=post(a.post);ensure(p.poll,"This post has no poll.");if(a.option===null)delete p.poll.votes[me.id];else{ensure(a.option<p.poll.options.length,"Choose one of this poll’s options.");p.poll.votes[me.id]=a.option}break}
  case "reminder": {const e=event(a.event);e.reminders??={};if(a.minutes===null)delete e.reminders[me.id];else{ensure(eventStartMs(e)>now,"This event has already started.");const previous=e.reminders[me.id];e.reminders[me.id]={minutes:a.minutes,...(previous?.minutes===a.minutes?{sentFor:previous.sentFor}:{})}}break}
  case "onboard": if(a.interests)me.interests=[...new Set(a.interests)];me.onboarded=true;break;
  case "editPost": {const p=post(a.post);ensure(p.author===me.id,"Only the author can edit this post.");ensure(!!a.text||!!p.image,"Write a post or add a photo.");mentions(a.text,"post",p.id,p.text);p.text=a.text;p.editedAt=now;break}
  case "editComment": {ensure(!!a.post!==!!a.event,"Choose one post or event.");const t=a.post?post(a.post):event(a.event!);const c=t.comments.find(c=>c.id===a.comment);ensure(c&&c.author===me.id,"Only the author can edit this comment.");mentions(a.text,a.post?"post":"event",t.id,c.text);c.text=a.text;c.editedAt=now;break}
  case "restorePost": {const removed=s.removedPosts?.find(x=>x.post.id===a.post&&x.by===me.id);ensure(removed&&now-removed.at<=300000,"The undo window has expired.");ensure(s.posts.length<250,"Remove another post first.");ensure(!s.posts.some(p=>p.id===a.post),"Post already restored.");s.posts.push(removed.post);s.removedPosts=s.removedPosts!.filter(x=>x!==removed);break}
  case "switch": person(a.member);s.actor=a.member;break;
  case "post": {
   ensure(!!a.text||!!a.image,"Write a post or add a photo.");if(a.poll){ensure(!!a.text,"Add your poll question.");ensure(!a.image,"Choose a poll or a photo for this post.");ensure(new Set(a.poll.map(x=>x.toLowerCase())).size===a.poll.length,"Each poll option must be different.")}
   if(a.wall){person(a.wall);ensure(a.wall===me.id||isFriend(s,me.id,a.wall),"Add this person as a friend before writing on their Wall.")}
   if(a.club)ensure(s.clubs.find(c=>c.id===a.club)?.leaders.includes(me.id),"Only this club’s leaders can post club announcements.");
   if(a.event)event(a.event);
   ensure(!a.tags.length||!!a.image,"Tags are available on photo posts.");a.tags.forEach(person);
   ensure(s.posts.length<250,"Your demo has reached 250 posts. Remove an old post to make room.");
   const p:Post={...(a.poll?{poll:{options:a.poll,votes:{}}}:{}),id:uid(),author:me.id,text:a.text,at:now,wall:a.wall,club:a.club,event:a.event,image:a.image,tags:[...new Set(a.tags)].map(member=>({member,approved:member===me.id})),likes:[],comments:[]};
   s.posts.unshift(p);mentions(p.text,"post",p.id);if(a.wall)notify(a.wall,`${me.name} wrote on your Wall.`,"post",p.id);
   p.tags.forEach(t=>notify(t.member,`${me.name} tagged you in a photo. Review it before it appears on your profile.`,"tags",p.id));break;
  }
  case "like": {const p=post(a.post);if(p.likes.includes(me.id))p.likes=p.likes.filter(x=>x!==me.id);else{p.likes.push(me.id);notify(p.author,`${me.name} liked your post.`,"post",p.id)}break}
  case "comment": {ensure(!!a.post!==!!a.event,"Choose one post or event.");const target=a.post?post(a.post):event(a.event!);ensure(target.comments.length<150,"This discussion has reached the demo limit.");const reply=a.replyTo?target.comments.find(c=>c.id===a.replyTo):undefined;ensure(!a.replyTo||reply,"The comment you’re replying to is no longer available.");mentions(a.text,a.post?"post":"event",target.id);target.comments.push({id:uid(),author:me.id,text:a.text,at:now,replyTo:a.replyTo});const owner="author" in target?target.author:target.creator;notify(owner,`${me.name} commented on your ${a.post?"post":"event"}.`,a.post?"post":"event",target.id);if(reply&&reply.author!==owner)notify(reply.author,`${me.name} replied to your comment.`,a.post?"post":"event",target.id);break}
  case "deletePost": {const p=post(a.post);ensure(p.author===me.id||p.wall===me.id||me.role==="admin","You can only remove your own posts or posts on your Wall.");s.removedPosts=[...(s.removedPosts??[]).filter(x=>now-x.at<=300000),{post:p,by:me.id,at:now}].slice(-20);s.posts=s.posts.filter(p=>p.id!==a.post);break}
  case "request": {person(a.member);ensure(a.member!==me.id,"You can’t add yourself.");ensure(!isFriend(s,me.id,a.member),"You’re already friends.");ensure(!s.requests.some(r=>pair(r.from,r.to)===pair(me.id,a.member)),"A friend request is already pending.");s.requests.push({from:me.id,to:a.member});notify(a.member,`${me.name} sent you a friend request.`,"requests",me.id);break}
  case "respondRequest": {ensure(s.requests.some(r=>r.to===me.id&&r.from===a.member),"Friend request not found.");s.requests=s.requests.filter(r=>!(r.to===me.id&&r.from===a.member));if(a.accept){s.friends.push(pair(me.id,a.member));notify(a.member,`${me.name} accepted your friend request.`,"profile",me.id)}break}
  case "cancelRequest":s.requests=s.requests.filter(r=>!(r.from===me.id&&r.to===a.member));break;
  case "poke": {person(a.member);ensure(a.member!==me.id,"You can’t poke yourself.");ensure(!s.pokes.some(p=>p.from===me.id&&p.to===a.member),"Wait for a poke back first.");s.pokes=s.pokes.filter(p=>pair(p.from,p.to)!==pair(me.id,a.member));s.pokes.push({from:me.id,to:a.member});notify(a.member,`${me.name} poked you.`,"profile",me.id);break}
  case "follow": {const c=s.clubs.find(c=>c.id===a.club);ensure(c,"Club not found.");c.followers=c.followers.includes(me.id)?c.followers.filter(x=>x!==me.id):[...c.followers,me.id];break}
  case "message": {person(a.member);ensure(a.member!==me.id,"Choose someone else to message.");ensure(isFriend(s,me.id,a.member),"Become friends before sending a message.");ensure(s.messages.length<1000,"Your demo message limit has been reached.");s.messages.push({id:uid(),from:me.id,to:a.member,text:a.text,at:now,read:false});break}
  case "readMessages": s.messages.forEach(m=>{if(m.to===me.id&&m.from===a.member)m.read=true});break;
  case "readNotices":s.notices.forEach(n=>{if(n.to===me.id&&(!a.notice||n.id===a.notice))n.read=true});break;
  case "rsvp": {const e=event(a.event);if(a.status==="none")delete e.rsvps[me.id];else e.rsvps[me.id]=a.status;break}
  case "saveEvent": {const existing=a.id?event(a.id):undefined;ensure(canManageEvent(s,me.id,existing??{club:a.club,creator:me.id}),"Only assigned club leaders can manage that club’s events. TAMS organizers manage school events.");ensure(!existing||existing.club===a.club,"An event’s host cannot be changed.");ensure(!a.club||s.clubs.some(c=>c.id===a.club),"Club not found.");ensure(new Date(`${a.date}T12:00:00Z`).toISOString().slice(0,10)===a.date,"Enter a valid date.");ensure(a.date>=s.day,"Choose today or a future date.");if(a.arrivalHost)person(a.arrivalHost);const {type,id:eventId,...fields}=a;void type;void eventId;if(existing){const changes:string[]=[];if(existing.date!==a.date||existing.time!==a.time)changes.push("time: "+existing.date+" "+existing.time+" → "+a.date+" "+a.time+" CT");if(existing.location!==a.location)changes.push("location: "+existing.location+" → "+a.location);Object.assign(existing,fields,{demoDatePinned:true});if(changes.length)Object.keys(existing.rsvps).forEach(member=>notify(member,existing.title+" updated — "+changes.join("; "),"event",existing.id))}else{ensure(s.events.length<100,"The demo event limit has been reached.");s.events.push({id:uid(),...fields,creator:me.id,rsvps:{},comments:[]})}break}
  case "profile": {if(a.birthday){const [m,d]=a.birthday.split("-").map(Number);const check=new Date(2024,m-1,d);ensure(check.getMonth()===m-1&&check.getDate()===d,"Enter a valid birthday month and day.")}ensure(!a.birthdayVisible||a.birthday,"Add your birthday to turn reminders on.");Object.assign(me,{bio:a.bio,interests:a.interests,music:a.music,books:a.books,birthday:a.birthday,birthdayVisible:a.birthdayVisible,...(a.photo?{photo:a.photo}:{})});break}
  case "tag": {const p=post(a.post);const t=p.tags.find(t=>t.member===me.id);ensure(t,"Photo tag not found.");if(a.accept)t.approved=true;else p.tags=p.tags.filter(t=>t.member!==me.id);break}
  case "report":post(a.post);ensure(!s.reports.some(r=>r.post===a.post&&r.by===me.id&&!r.resolved),"You’ve already reported this post.");s.reports.push({id:uid(),by:me.id,post:a.post,reason:a.reason,resolved:false});s.members.filter(m=>m.role==="admin").forEach(m=>notify(m.id,"A post was reported for review.","post",a.post));break;
  case "resolveReport": {ensure(me.role==="admin","Only community admins can review reports.");const r=s.reports.find(r=>r.id===a.report);ensure(r,"Report not found.");r.resolved=true;if(a.remove)s.posts=s.posts.filter(p=>p.id!==r.post);break}
  case "assignLeader": {ensure(me.role==="admin","Only community admins assign club leaders.");const c=s.clubs.find(c=>c.id===a.club);ensure(c,"Club not found.");const m=person(a.member);ensure(["student","alumni"].includes(m.role),"Choose a student or alumnus.");if(a.add)c.leaders=[...new Set([...c.leaders,m.id])];else{ensure(c.leaders.length>1,"Keep at least one club leader.");c.leaders=c.leaders.filter(x=>x!==m.id)}break}
 }
 s.notices=s.notices.slice(0,1000);s.version=original.version+1;return s;
}
