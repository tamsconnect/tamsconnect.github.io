import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Users, CalendarDays, MessageCircle, Camera, Loader2 } from 'lucide-react';
import CommunityApp from './commons';
import { assetUrl, readRoute, routeHref } from '@/lib/browser-routing';
import { createDemoAccount, readDemoAccess, signInDemoAccount, signOutDemoAccount, storePhoto } from '@/lib/browser-storage';
import { DEMO_CAMPUS_CODE, MAX_STUDENT_CLASS, validateDemoEligibility, type DemoProfileInput } from '@/lib/demo-access';
import type { Member } from '@/lib/community';
import { ZodError } from 'zod';

const INTERESTS = ['Computer science', 'Robotics', 'Research', 'Medicine', 'Business', 'Art', 'Music', 'Volunteering', 'Sports', 'Gaming', 'Photography', 'Books', 'Astronomy', 'Coffee', 'Movies', 'Cooking'];
const freshProfile = (): DemoProfileInput => ({ affiliation: 'student', year: String(Math.min(new Date().getFullYear() + 2, MAX_STUDENT_CLASS)), campusCode: '', fullName: '', nickname: '', bio: '', interests: [] });
const initialRoute = () => { const route = readRoute(); return ['/login', '/join'].includes(route) ? '/' : route; };
const errorMessage = (reason: unknown, fallback: string) => reason instanceof ZodError ? reason.issues[0]?.message ?? fallback : reason instanceof Error ? reason.message : fallback;

export default function DemoEntry() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profiles, setProfiles] = useState<Member[]>([]);
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<DemoProfileInput>(freshProfile);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const returnRoute = useRef(initialRoute());
  const heading = useRef<HTMLHeadingElement>(null);
  const attempt = useRef(false);
  const [selected, setSelected] = useState('');

  async function refresh() {
    setLoading(true); setError('');
    try {
      const value = await readDemoAccess();
      setProfiles(value.profiles);
      setSelected(value.profiles.find(member => member.id === 'alex')?.id ?? value.profiles[0]?.id ?? '');
      setSignedIn(!!value.access.active);
      if (value.access.active && ['/login', '/join'].includes(readRoute())) window.history.replaceState({}, '', routeHref('/'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open your saved profiles. Please retry.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (!signedIn) document.title = `TAMS Connect - ${mode === 'create' ? 'Create Account' : 'Sign In'}`; }, [signedIn, mode]);
  useEffect(() => { if (!loading && !signedIn) heading.current?.focus(); }, [step, mode, loading, signedIn]);
  const change = <K extends keyof DemoProfileInput>(key: K, value: DemoProfileInput[K]) => { setError(''); setProfile(previous => ({ ...previous, [key]: value })); };

  async function enter(memberId: string) {
    if (attempt.current) return;
    attempt.current = true; setBusy(true); setError('');
    try {
      await signInDemoAccount(memberId);
      window.history.replaceState({}, '', routeHref(returnRoute.current));
      setSignedIn(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign in. Please retry.'); }
    finally { attempt.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      if (step === 0) { validateDemoEligibility(profile); setStep(1); return; }
      if (step === 1) { if (profile.fullName.trim().length < 2) throw new Error('Enter a name with at least two characters.'); setStep(2); return; }
      if (attempt.current) return;
      attempt.current = true; setBusy(true);
      await createDemoAccount(profile);
      window.history.replaceState({}, '', routeHref(returnRoute.current));
      setProfile(freshProfile()); setStep(0); setSignedIn(true);
    } catch (reason) { setError(errorMessage(reason, 'Could not save your profile. Your details are still here. Please retry.')); }
    finally { attempt.current = false; setBusy(false); }
  }

  async function logout() {
    if (attempt.current) return;
    attempt.current = true;
    try {
      await signOutDemoAccount();
      returnRoute.current = '/';
      window.history.replaceState({}, '', routeHref('/login'));
      setMode('login'); setStep(0); setProfile(freshProfile()); setSignedIn(false);
      await refresh();
    } finally { attempt.current = false; }
  }

  if (loading) return <main className="session-restoring" role="status"><Loader2 className="entry-spin" size={24}/><span>Loading TAMS Connect…</span></main>;
  if (signedIn) return <CommunityApp onSignOut={logout}/>;
  const year = new Date().getFullYear();
  const years = profile.affiliation === 'student' ? Array.from({ length: Math.max(0, Math.min(year + 4, MAX_STUDENT_CLASS) - year + 1) }, (_, i) => year + i) : Array.from({ length: year - 1980 + 1 }, (_, i) => year - i);
  const switchMode = (next: 'login' | 'create') => { setMode(next); setError(''); };

  return <div className="entry-page">
    <aside className="entry-brand" aria-label="TAMS Connect">
      <a href={routeHref('/')} onClick={event => { event.preventDefault(); switchMode('login'); }} className="entry-logo"><img src={assetUrl('brand/wordmark-aligned.svg')} alt="TAMS Connect"/></a>
      <img className="entry-eagle" src={assetUrl('brand/eagle.png')} alt=""/>
      <div className="entry-brand-body">
        <h1>TAMS<br/>CONNECT</h1>
        <p>A social network connecting TAMS students and alumni.</p>
        <div className="entry-brand-links"><span><Users size={19}/>People</span><span><CalendarDays size={19}/>Clubs & events</span><span><MessageCircle size={19}/>Conversations</span></div>
      </div>
      <p className="entry-independent">Not affiliated with TAMS or UNT.<br/>An independent project by Subhas Angara.</p>
    </aside>
    <main className="entry-main">
      <div className="entry-form-area" key={`${mode}-${step}`}>
        {loading ? <div className="entry-loading" role="status"><Loader2 className="entry-spin" size={26}/>Opening your demo…</div> : <>
          <h2 ref={heading} tabIndex={-1}>{mode === 'login' ? 'Welcome to TAMS Connect' : ['Your TAMS community', 'Set up your profile', 'What are you into?'][step]}</h2>
          <p className="entry-intro">{mode === 'login' ? 'Meet people, make plans, and keep in touch.' : ['Try how a TAMS-only account setup could work.', 'Choose how you want to appear in the community.', 'Choose up to eight interests. You can change them later.'][step]}</p>
          {error && <div id="entry-form-error" className="entry-error" role="alert">{error}{mode === 'login' && !profiles.length && <button type="button" onClick={() => void refresh()}>Retry loading</button>}</div>}
          {mode === 'login' ? <div className="entry-login">
            {!!profiles.length && <form onSubmit={event => { event.preventDefault(); void enter(selected); }}>
              <label htmlFor="saved-profile">Choose a demo profile</label>
              <select id="saved-profile" value={selected} onChange={event => setSelected(event.target.value)} disabled={busy}>{profiles.map(member => <option value={member.id} key={member.id}>{member.name}{member.year ? ` · TAMS ’${member.year.slice(-2)}` : member.role === 'organizer' ? ' · Organizer' : ' · Admin'}</option>)}</select>
              <button className="entry-primary" disabled={busy || !selected}>{busy ? <Loader2 className="entry-spin" size={17}/> : <ArrowRight size={17}/>}Sign in</button>
            </form>}
            <button type="button" className={profiles.length ? 'entry-secondary' : 'entry-primary'} disabled={busy} onClick={() => switchMode('create')}>Create a demo account<ArrowRight size={17}/></button>
            <div className="entry-divider"><span>or</span></div>
            <button type="button" className="entry-secondary" disabled={busy} onClick={() => void enter('alex')}>{busy && <Loader2 className="entry-spin" size={17}/>}Explore the demo</button>
            <p className="entry-help">Explore as Alex, or make a profile of your own.</p>
          </div> : <>
            <ol className="entry-steps" aria-label={`Account setup: step ${step + 1} of 3`}>{['Campus', 'Profile', 'Interests'].map((label, i) => <li className={i === step ? 'active' : i < step ? 'complete' : ''} key={label}><span>{i < step ? <Check size={13}/> : i + 1}</span>{label}</li>)}</ol>
            <form className="entry-setup" onSubmit={submit}>
              {step === 0 && <>
                <label htmlFor="affiliation">TAMS connection</label><select id="affiliation" value={profile.affiliation} onChange={event => { const affiliation = event.target.value as 'student' | 'alumni'; setProfile(previous => ({ ...previous, affiliation, year: String(affiliation === 'student' ? Math.min(year + 2, MAX_STUDENT_CLASS) : year - 2) })); setError(''); }}><option value="student">TAMS student</option><option value="alumni">TAMS alumnus / alumna</option></select>
                <label htmlFor="class-year">Graduating class</label><select id="class-year" value={profile.year} onChange={event => change('year', event.target.value)}>{years.map(value => <option value={value} key={value}>Class of {value}</option>)}</select>
                <label htmlFor="campus-code">Demo campus code</label><input id="campus-code" required autoComplete="off" spellCheck={false} maxLength={30} value={profile.campusCode} onChange={event => change('campusCode', event.target.value)} placeholder="TAMS-DEMO" aria-invalid={!!error} aria-describedby={error ? "entry-form-error campus-code-help" : "campus-code-help"}/>
                <p id="campus-code-help" className="entry-help">Use <button className="entry-inline" type="button" onClick={() => change('campusCode', DEMO_CAMPUS_CODE)}>{DEMO_CAMPUS_CODE}</button> to try this step. It is not an official TAMS access code.</p>
              </>}
              {step === 1 && <>
                <label className="entry-photo"><span className="entry-avatar">{profile.photo ? <img src={profile.photo} alt="Your profile preview"/> : <Camera size={24}/>}</span><span>{uploading ? 'Preparing photo…' : 'Add a profile photo'}<small>Optional · PNG, JPG or WebP, up to 5 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || busy} onChange={async event => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); setError(''); try { change('photo', await storePhoto(file)); } catch (reason) { setError((reason as Error).message); } finally { setUploading(false); } }}/></label>
                {profile.photo && <button type="button" className="entry-inline" onClick={() => change('photo', undefined)}>Remove photo</button>}
                <label htmlFor="full-name">Name</label><input id="full-name" required minLength={2} maxLength={60} autoComplete="off" value={profile.fullName} onChange={event => change('fullName', event.target.value)} placeholder="Use a fictional name for the demo"/>
                <label htmlFor="nickname">Nickname / display name <span>(optional)</span></label><input id="nickname" maxLength={40} autoComplete="off" value={profile.nickname} onChange={event => change('nickname', event.target.value)} placeholder="What should people call you?"/>
                <label htmlFor="profile-bio">About you <span>(optional)</span></label><textarea id="profile-bio" rows={3} maxLength={500} value={profile.bio} onChange={event => change('bio', event.target.value)} placeholder="A little about you, or what you'd like to meet people for."/>
              </>}
              {step === 2 && <fieldset className="entry-interests"><legend className="sr-only">Choose your interests</legend>{INTERESTS.map(interest => { const picked = profile.interests?.includes(interest); return <button type="button" key={interest} aria-pressed={!!picked} className={picked ? 'picked' : ''} disabled={!picked && (profile.interests?.length ?? 0) >= 8} onClick={() => change('interests', picked ? profile.interests!.filter(value => value !== interest) : [...(profile.interests ?? []), interest])}>{picked && <Check size={14}/>} {interest}</button>; })}<p className="entry-help" aria-live="polite">{profile.interests?.length ?? 0} of 8 selected · Choosing interests is optional.</p></fieldset>}
              <div className="entry-form-actions"><button type="button" className="entry-back" disabled={busy} onClick={() => { setError(''); if (step) setStep(step - 1); else switchMode('login'); }}><ArrowLeft size={16}/>Back</button><button className="entry-primary" disabled={busy || uploading}>{busy ? <Loader2 className="entry-spin" size={17}/> : <ArrowRight size={17}/>} {step === 2 ? 'Join the community' : 'Continue'}</button></div>
            </form>
          </>}
        </>}
      </div>
    </main>
  </div>;
}
