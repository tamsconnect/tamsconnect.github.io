import { z } from 'zod';
import type { World, Member } from './community.ts';

/** UX simulation only. A public client-side code cannot verify TAMS membership. */
export const DEMO_CAMPUS_CODE = 'TAMS-DEMO';
export const MAX_STUDENT_CLASS = 2029;
export const demoEligibilitySchema = z.object({
  affiliation: z.enum(['student', 'alumni']),
  year: z.string().regex(/^\d{4}$/),
  campusCode: z.string().trim().toUpperCase().refine(value => value === DEMO_CAMPUS_CODE, 'Use TAMS-DEMO to try the campus access step.'),
});
export const demoProfileSchema = demoEligibilitySchema.extend({
  fullName: z.string().trim().min(2, 'Enter a name with at least two characters.').max(60),
  nickname: z.string().trim().max(40).default(''),
  bio: z.string().trim().max(500).default(''),
  interests: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  photo: z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(7 * 1024 * 1024).optional(),
});
export type DemoProfileInput = z.input<typeof demoProfileSchema>;
export type DemoAccess = { version: 1; accounts: string[]; active: string | null; sampleProfilesVersion?: 1 };
export const emptyDemoAccess = (): DemoAccess => ({ version: 1, accounts: [], active: null });
const DEMO_PERSONAS = ['alex', 'maya', 'sam', 'priya', 'jordan', 'eli', 'nora', 'leo', 'organizer', 'admin'];

export function selectableDemoProfiles(world: World, access: DemoAccess): Member[] {
  return world.members.filter(member => DEMO_PERSONAS.includes(member.id) || access.accounts.includes(member.id));
}

/** Retire the account used to test setup once, without removing later visitor accounts. */
export function retireSetupSample(world: World, access: DemoAccess) {
  if (access.sampleProfilesVersion === 1) return { world, access };
  const ids = new Set(world.members.filter(member => member.id.startsWith('visitor-') && member.fullName === 'Taylor Rivera' && member.nickname === 'Tay' && member.year === '2028').map(member => member.id));
  const nextAccess: DemoAccess = { ...access, sampleProfilesVersion: 1, accounts: access.accounts.filter(id => !ids.has(id)), active: access.active && ids.has(access.active) ? 'alex' : access.active };
  if (!ids.size) return { world, access: nextAccess };
  const next = structuredClone(world);
  next.members = next.members.filter(member => !ids.has(member.id));
  if (ids.has(next.actor)) next.actor = 'alex';
  const cleanComments = (comments: World['posts'][number]['comments']) => {
    const removed = new Set(comments.filter(comment => ids.has(comment.author)).map(comment => comment.id));
    return comments.filter(comment => !removed.has(comment.id)).map(comment => removed.has(comment.replyTo ?? '') ? { ...comment, replyTo: undefined } : comment);
  };
  const removedPosts = new Set(next.posts.filter(post => ids.has(post.author) || ids.has(post.wall ?? '')).map(post => post.id));
  next.posts = next.posts.filter(post => !removedPosts.has(post.id)).map(post => ({ ...post, tags: post.tags.filter(tag => !ids.has(tag.member)), likes: post.likes.filter(id => !ids.has(id)), comments: cleanComments(post.comments), ...(post.poll ? { poll: { ...post.poll, votes: Object.fromEntries(Object.entries(post.poll.votes).filter(([id]) => !ids.has(id))) } } : {}) }));
  next.clubs.forEach(club => { club.followers = club.followers.filter(id => !ids.has(id)); club.leaders = club.leaders.filter(id => !ids.has(id)); });
  next.events.forEach(event => {
    event.rsvps = Object.fromEntries(Object.entries(event.rsvps).filter(([id]) => !ids.has(id)));
    if (event.reminders) event.reminders = Object.fromEntries(Object.entries(event.reminders).filter(([id]) => !ids.has(id)));
    if (ids.has(event.arrivalHost ?? '')) delete event.arrivalHost;
    event.comments = cleanComments(event.comments);
  });
  next.friends = next.friends.filter(pair => !pair.split(':').some(id => ids.has(id)));
  next.requests = next.requests.filter(item => !ids.has(item.from) && !ids.has(item.to));
  next.pokes = next.pokes.filter(item => !ids.has(item.from) && !ids.has(item.to));
  next.messages = next.messages.filter(item => !ids.has(item.from) && !ids.has(item.to));
  next.notices = next.notices.filter(item => !ids.has(item.to) && !ids.has(item.target) && !removedPosts.has(item.target));
  next.reports = next.reports.filter(item => !ids.has(item.by) && !removedPosts.has(item.post));
  next.receipts = next.receipts?.filter(item => !ids.has(item.actor));
  next.removedPosts = next.removedPosts?.filter(item => !ids.has(item.by) && !ids.has(item.post.author) && !ids.has(item.post.wall ?? ''));
  next.members.forEach(member => { if (member.saved) member.saved = member.saved.filter(item => item.kind !== 'post' || !removedPosts.has(item.target)); });
  next.version++;
  return { world: next, access: nextAccess };
}

/** Keep an existing session through persona switches; an explicit sign-out stays signed out. */
export function restoreDemoAccess(world: World, access: DemoAccess): DemoAccess {
  const exists = (id: string) => world.members.some(member => member.id === id);
  const accounts = access.accounts.filter(exists);
  const active = access.active && exists(access.active) ? (exists(world.actor) ? world.actor : access.active) : null;
  return { ...access, accounts, active };
}

export function validateDemoEligibility(input: unknown, currentYear = new Date().getFullYear()) {
  const value = demoEligibilitySchema.parse(input);
  const year = Number(value.year);
  const valid = value.affiliation === 'student' ? year >= currentYear && year <= Math.min(currentYear + 4, MAX_STUDENT_CLASS) : year >= 1980 && year <= currentYear;
  if (!valid) throw new Error(value.affiliation === 'student' ? `Choose a current class year through ${MAX_STUDENT_CLASS}.` : 'Choose a class year that has already graduated.');
  return value;
}

export function registerDemoMember(original: World, input: unknown, memberId: string, currentYear = new Date().getFullYear()): World {
  const value = demoProfileSchema.parse(input);
  validateDemoEligibility(value, currentYear);
  if (!/^visitor-[a-zA-Z0-9-]+$/.test(memberId) || original.members.some(member => member.id === memberId)) throw new Error('Could not create this profile. Please try again.');
  if (original.members.length >= 60) throw new Error('This browser has reached the demo profile limit. Continue with a saved profile instead.');
  const name = value.nickname || value.fullName;
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!handle) throw new Error('Include a letter or number in your display name.');
  if (original.members.some(member => member.name.toLowerCase().replace(/[^a-z0-9]/g, '') === handle)) throw new Error('That display name is already used in this demo. Try adding a last name or a different nickname.');
  const member: Member = {
    id: memberId, name, fullName: value.fullName, nickname: value.nickname, year: value.year,
    role: value.affiliation, bio: value.bio, interests: [...new Set(value.interests)],
    music: '', books: '', color: 'green', birthday: '', birthdayVisible: false,
    onboarded: false, saved: [], ...(value.photo ? { photo: value.photo } : {}),
  };
  return { ...structuredClone(original), members: [...original.members, member], actor: member.id, version: original.version + 1 };
}

export function activateDemoMember(world: World, access: DemoAccess, memberId: string) {
  if (!DEMO_PERSONAS.includes(memberId) && !access.accounts.includes(memberId)) throw new Error('Choose an available demo profile or a profile saved in this browser.');
  if (!world.members.some(member => member.id === memberId)) throw new Error('This saved profile is no longer available.');
  return { world: { ...world, actor: memberId, version: world.version + 1 }, access: { ...access, active: memberId } };
}
