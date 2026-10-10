import { isFriend, type World, type Member, type Post, type Club, type Event } from './community.ts';

const aliases: Record<string, string> = { 'computer science': 'coding', 'programming': 'coding', 'web development': 'coding', 'gaming': 'games', 'board games': 'games', 'volunteering': 'service', 'volunteer': 'service', 'running': 'sports' };
const canonical = (value: string) => aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase();

export function sharedInterests(a: Member, b: Member): string[] {
  const interests = new Set(b.interests.map(canonical));
  return a.interests.filter(interest => interests.has(canonical(interest)));
}

const clubTopics: Record<string, string[]> = {
  cs: ['business', 'coding'], robotics: ['robotics', 'coding'], astronomy: ['astronomy', 'research', 'coding'],
  music: ['games', 'sports', 'community'], medical: ['medicine', 'research', 'service'],
  outdoors: ['service'], art: ['service', 'art'], cla: ['business', 'service'],
};

export function clubRelevance(club: Club, me: Member): number {
  const topics = new Set(clubTopics[club.id] ?? []);
  return (club.followers.includes(me.id) ? 6 : 0) + me.interests.filter(interest => topics.has(canonical(interest))).length * 4;
}

function postRelevance(post: Post, world: World, me: Member, now: number): number {
  const author = world.members.find(member => member.id === post.author);
  const club = world.clubs.find(club => club.id === post.club);
  const event = world.events.find(event => event.id === post.event);
  const eventClub = world.clubs.find(club => club.id === event?.club);
  const ageHours = Math.max(0, (now - post.at) / 3_600_000);
  // Blend relevance and freshness; retain all community posts rather than hiding them.
  return (author && author.id !== me.id ? Math.min(sharedInterests(me, author).length, 3) * 4 : 0)
    + (club ? clubRelevance(club, me) : eventClub ? clubRelevance(eventClub, me) : 0)
    + (isFriend(world, me.id, post.author) ? 3 : 0)
    + Math.max(0, 6 - ageHours / 12)
    + (post.author === me.id && ageHours < 1 ? 24 : 0);
}

export function homePosts(world: World, me: Member, filter: string, now = Date.now()): Post[] {
  const posts = world.posts.filter(post => !post.wall && (filter !== 'Friends' || isFriend(world, me.id, post.author)) && (filter !== 'Clubs' || !!post.club));
  const personalized = ['For you', 'Everyone'].includes(filter);
  const hasPreferences = me.interests.length || world.clubs.some(club => club.followers.includes(me.id)) || world.friends.some(pair => pair.split(':').includes(me.id));
  if (!personalized || !hasPreferences) return posts.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  const ranked: Post[] = [];
  while (posts.length) {
    const recent = ranked.slice(-2);
    const score = (post: Post) => postRelevance(post, world, me, now) - recent.filter(previous => previous.author === post.author).length * 8;
    posts.sort((a, b) => score(b) - score(a) || b.at - a.at || a.id.localeCompare(b.id));
    ranked.push(posts.shift()!);
  }
  return ranked;
}

export function occasionalReasons(posts: Post[], world: World, me: Member): Map<string, string> {
  const reasons = new Map<string, string>();
  let previous = -5;
  for (let index = 2; index < posts.length && reasons.size < 2; index++) {
    if (index - previous < 6) continue;
    const post = posts[index];
    if (post.club || post.author === me.id) continue;
    const author = world.members.find(member => member.id === post.author);
    const interest = author && sharedInterests(me, author)[0];
    if (interest) { reasons.set(post.id, `You both like ${interest.toLowerCase()}`); previous = index; }
  }
  return reasons;
}

export function suggestedEvents(world: World, me: Member): Event[] {
  const score = (event: Event) => {
    const club = world.clubs.find(club => club.id === event.club);
    return (club ? clubRelevance(club, me) : 0) + (event.rsvps[me.id] ? 8 : 0);
  };
  return world.events.filter(event => event.date >= world.day).sort((a, b) => score(b) - score(a) || (a.date + a.time).localeCompare(b.date + b.time));
}
