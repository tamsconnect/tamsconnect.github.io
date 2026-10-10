import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorld } from '../src/lib/community.ts';
import { homePosts, occasionalReasons, sharedInterests, clubRelevance } from '../src/lib/personalization.ts';

test('signup interests match existing profile vocabulary without inventing shared interests', () => {
  const world = seedWorld();
  const me = { ...world.members[0], interests: ['Computer science', 'Gaming', 'Volunteering'] };
  const other = { ...world.members[1], interests: ['Coding', 'Board games', 'Art'] };
  assert.deepEqual(sharedInterests(me, other), ['Computer science', 'Gaming']);
  assert.ok(clubRelevance(world.clubs.find(club => club.id === 'robotics'), me) > 0);
});

test('For you changes with interests while retaining all public posts and a chronological alternative', () => {
  const now = Date.now();
  const world = seedWorld(now);
  world.friends = [];
  world.clubs.forEach(club => { club.followers = []; });
  world.posts = world.posts.filter(post => !post.wall);
  const coding = { ...world.members[0], interests: ['Computer science'] };
  const art = { ...coding, interests: ['Art'] };
  assert.notDeepEqual(homePosts(world, coding, 'For you', now).map(post => post.id), homePosts(world, art, 'For you', now).map(post => post.id));
  assert.deepEqual(homePosts(world, coding, 'For you', now).map(post => post.id).sort(), world.posts.map(post => post.id).sort());
  const latest = homePosts(world, coding, 'Latest', now);
  assert.ok(latest.every((post, index) => !index || latest[index - 1].at >= post.at));
  const empty = { ...coding, interests: [] };
  assert.deepEqual(homePosts(world, empty, 'For you', now).map(post => post.id), homePosts(world, empty, 'Latest', now).map(post => post.id));
  const own = { ...world.posts[0], id: 'new-own-post', author: coding.id, at: now, club: undefined };
  world.posts.push(own);
  assert.equal(homePosts(world, coding, 'For you', now)[0].id, own.id);
});

test('feed explanations are sparse, truthful, and never describe your own posts', () => {
  const world = seedWorld();
  const me = { ...world.members[0], interests: ['Art'] };
  const posts = Array.from({ length: 20 }, (_, index) => ({ ...world.posts[0], id: 'example-' + index, author: 'maya', club: undefined }));
  const reasons = occasionalReasons(posts, world, me);
  assert.equal(reasons.size, 2);
  const indexes = [...reasons.keys()].map(id => posts.findIndex(post => post.id === id));
  assert.ok(indexes[1] - indexes[0] >= 6);
  assert.ok([...reasons.values()].every(reason => reason === 'You both like art'));
  assert.equal(occasionalReasons(posts, world, { ...me, interests: [] }).size, 0);
  assert.equal(occasionalReasons(posts.map(post => ({ ...post, author: me.id })), world, me).size, 0);
});
