import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorld, applyAction } from '../src/lib/community.ts';
import { validateDemoEligibility, registerDemoMember, activateDemoMember, emptyDemoAccess, restoreDemoAccess, retireSetupSample, selectableDemoProfiles } from '../src/lib/demo-access.ts';

const input = (extra = {}) => ({ affiliation: 'student', year: '2028', campusCode: 'TAMS-DEMO', fullName: 'Taylor Rivera', nickname: 'Tay', bio: 'Robotics and new friends.', interests: ['Robotics', 'Art'], ...extra });
const register = (world = seedWorld(), extra = {}, id = 'visitor-test') => registerDemoMember(world, input(extra), id, 2026);

test('the campus step accepts only the published simulation code and student/alumni class ranges', () => {
  assert.equal(validateDemoEligibility(input({campusCode:' tams-demo '}), 2026).campusCode, 'TAMS-DEMO');
  assert.throws(() => validateDemoEligibility(input({campusCode:'UNT'}), 2026), /TAMS-DEMO/);
  assert.throws(() => validateDemoEligibility(input({affiliation:'admin'}), 2026));
  for (const year of ['2025', '2030', '2031']) assert.throws(() => validateDemoEligibility(input({year}), 2026), /class year/);
  assert.equal(validateDemoEligibility(input({year:'2029'}), 2026).year, '2029');
  assert.equal(validateDemoEligibility(input({affiliation:'alumni',year:'2024'}), 2026).affiliation, 'alumni');
  for (const year of ['1979','2027']) assert.throws(() => validateDemoEligibility(input({affiliation:'alumni',year}), 2026), /graduated/);
});

test('registration creates a new unprivileged profile without inheriting seed friendships or messages', () => {
  const original=seedWorld(); const before=structuredClone(original); const next=register(original);
  assert.deepEqual(original,before);
  assert.equal(next.actor,'visitor-test'); assert.equal(next.version,original.version+1);
  const member=next.members.find(m=>m.id===next.actor);
  assert.equal(member.name,'Tay'); assert.equal(member.fullName,'Taylor Rivera'); assert.equal(member.nickname,'Tay');
  assert.equal(member.role,'student'); assert.deepEqual(member.interests,['Robotics','Art']);
  assert.equal(member.birthdayVisible,false); assert.deepEqual(member.saved,[]);
  assert.deepEqual(next.friends,original.friends); assert.deepEqual(next.requests,original.requests); assert.deepEqual(next.messages,original.messages);
  assert.throws(()=>applyAction(next,{type:'post',text:'Test announcement',club:'cs'}), /leaders/);
});

test('registration supports alumni, optional interests, default display name, and unique handles', () => {
  const next=register(seedWorld(),{nickname:'',affiliation:'alumni',year:'2024',interests:[]});
  assert.equal(next.members.at(-1).name,'Taylor Rivera'); assert.equal(next.members.at(-1).role,'alumni');
  assert.throws(()=>register(next,{nickname:'Taylor Rivera'},'visitor-second'),/already used/);
  const seed=seedWorld();
  assert.throws(()=>register(seed,{nickname:seed.members[0].name}),/already used/);
  assert.throws(()=>register(seedWorld(),{},'alex'),/Could not create/);
});

test('profile input rejects excessive interests, invalid photos, empty names and handles', () => {
  assert.throws(()=>register(seedWorld(),{fullName:' '}));
  assert.throws(()=>register(seedWorld(),{nickname:'!!!'}),/letter or number/);
  assert.throws(()=>register(seedWorld(),{interests:Array.from({length:9},(_,i)=>'Interest '+i)}));
  assert.throws(()=>register(seedWorld(),{photo:'https://example.com/photo.jpg'}));
  assert.deepEqual(register(seedWorld(),{interests:['Art','Art']}).members.at(-1).interests,['Art']);
});

test('return sign-in activates only an available demo persona or a saved profile', () => {
  const world=register(); const before=structuredClone(world); const access={...emptyDemoAccess(),accounts:['visitor-test']};
  const next=activateDemoMember(world,access,'visitor-test');
  assert.equal(next.access.active,'visitor-test'); assert.equal(next.world.actor,'visitor-test');
  assert.equal(access.active,null); assert.deepEqual(world,before);
  assert.throws(()=>activateDemoMember(world,access,'visitor-unsaved'),/saved in this browser/);
  assert.throws(()=>activateDemoMember(world,{...access,accounts:['visitor-missing']},'visitor-missing'),/no longer available/);
  assert.equal(activateDemoMember(world,emptyDemoAccess(),'alex').world.actor,'alex');
  for (const member of selectableDemoProfiles(seedWorld(), emptyDemoAccess())) {
    assert.equal(activateDemoMember(seedWorld(), emptyDemoAccess(), member.id).world.actor, member.id);
  }
});

test('retiring the setup sample removes Tay and related activity without resetting other profiles', () => {
  let world = register();
  world = applyAction(world, { type: 'post', text: 'Setup test post' });
  const postId = world.posts[0].id;
  world = applyAction(world, { type: 'follow', club: 'cs' });
  world = applyAction(world, { type: 'request', member: 'alex' });
  world = applyAction(world, { type: 'rsvp', event: 'kickoff', status: 'going' });
  world = register(world, { fullName: 'Jamie Lee', nickname: 'Jamie' }, 'visitor-jamie');
  const before = structuredClone(world);
  const cleaned = retireSetupSample(world, { ...emptyDemoAccess(), accounts: ['visitor-test', 'visitor-jamie'], active: 'visitor-jamie' });
  assert.deepEqual(world, before);
  assert.equal(cleaned.world.actor, 'visitor-jamie');
  assert.equal(cleaned.access.active, 'visitor-jamie');
  assert.deepEqual(cleaned.access.accounts, ['visitor-jamie']);
  assert.equal(cleaned.world.members.some(member => member.id === 'visitor-test'), false);
  assert.equal(cleaned.world.posts.some(post => post.id === postId), false);
  assert.equal(cleaned.world.requests.some(item => item.from === 'visitor-test'), false);
  assert.equal(cleaned.world.clubs.find(club => club.id === 'cs').followers.includes('visitor-test'), false);
  assert.equal(cleaned.world.events.find(event => event.id === 'kickoff').rsvps['visitor-test'], undefined);
  assert.equal(selectableDemoProfiles(cleaned.world, cleaned.access)[0].name, 'Alex Johnson');
  assert.equal(selectableDemoProfiles(cleaned.world, cleaned.access).at(-1).name, 'Jamie');
  const future = register(cleaned.world, {}, 'visitor-later');
  assert.equal(retireSetupSample(future, cleaned.access).world, future);
  const signedOut = retireSetupSample(register(), { ...emptyDemoAccess(), accounts: ['visitor-test'] });
  assert.equal(signedOut.access.active, null);
  const signedIn = retireSetupSample(register(), { ...emptyDemoAccess(), accounts: ['visitor-test'], active: 'visitor-test' });
  assert.equal(restoreDemoAccess(signedIn.world, signedIn.access).active, 'alex');
});

test('custom profiles can edit their name while retaining identity and activity', () => {
  const world=register();
  const action={type:'profile',fullName:'Taylor Rivera',nickname:'Taylor R',bio:'Updated',interests:['Art'],music:'Jazz',books:'Dune',birthday:'',birthdayVisible:false};
  const next=applyAction(world,action);
  assert.equal(next.members.at(-1).name,'Taylor R'); assert.equal(next.members.at(-1).id,'visitor-test');
  assert.deepEqual(next.messages,world.messages);
  assert.throws(()=>applyAction(world,{...action,nickname:world.members[0].name}),/already used/);
  assert.throws(()=>applyAction(seedWorld(),action),/original name/);
});

test('saved sessions survive switching, reload and reopening, while sign-out remains explicit', () => {
  const original=register();
  const saved={version:1,accounts:['visitor-test','visitor-missing'],active:'visitor-test'};
  for(const member of ['alex','maya','admin','visitor-test']){
    const world=applyAction(original,{type:'switch',member});
    const reopened=JSON.parse(JSON.stringify({world,access:saved}));
    const access=restoreDemoAccess(reopened.world,reopened.access);
    assert.equal(access.active,member);
    assert.deepEqual(access.accounts,['visitor-test']);
    assert.equal(restoreDemoAccess(world,{...saved,active:null}).active,null);
  }
  assert.equal(restoreDemoAccess(original,emptyDemoAccess()).active,null);
  assert.equal(restoreDemoAccess(original,{...saved,active:'visitor-deleted'}).active,null);
  assert.equal(saved.active,'visitor-test');
});
