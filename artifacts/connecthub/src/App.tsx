import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  Compass,
  Heart,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  getGetCommentsQueryKey,
  getGetDiscoverQueryKey,
  getGetFeedQueryKey,
  getGetMeQueryKey,
  getGetNotificationsQueryKey,
  getGetSessionQueryKey,
  getGetUserProfileQueryKey,
  getSearchUsersQueryKey,
  useCreateComment,
  useCreatePost,
  useGetComments,
  useGetDiscover,
  useGetFeed,
  useGetMe,
  useGetNotifications,
  useGetSession,
  useGetUserPosts,
  useGetUserProfile,
  useLikePost,
  useLogin,
  useLogout,
  useRegister,
  useSearchUsers,
  useUnlikePost,
  useUpdateMe,
  useFollowUser,
  useUnfollowUser,
  useRequestUploadUrl,
} from '@workspace/api-client-react';
import type { Comment, Discover, Post, Session, UserProfile, UserSummary } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Avatar({ user, size = 'md' }: { user?: UserSummary | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'CH';
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-20 w-20 text-xl' };
  return user?.avatarUrl ? (
    <img data-testid={`img-avatar-${user.id}`} src={user.avatarUrl} alt={`${user.name} avatar`} className={`${sizes[size]} rounded-2xl object-cover ring-2 ring-background`} />
  ) : (
    <div data-testid={`avatar-fallback-${user?.id ?? 'guest'}`} className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-2xl bg-secondary font-display font-bold text-foreground ring-2 ring-background`}>
      {initials}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" data-testid="link-logo" className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-primary shadow-[4px_4px_0_hsl(var(--secondary))]">
        <span className="h-3 w-3 rounded-full border-[3px] border-primary-foreground" />
        <span className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-primary-foreground" />
      </span>
      {!compact && <span className="font-display text-[21px] font-bold tracking-[-.04em] text-sidebar-foreground">connect<span className="text-primary">hub</span></span>}
    </Link>
  );
}

function LoadingBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className}`} aria-label="Loading" data-testid="status-loading" />;
}

function ErrorState({ message = 'Something went sideways.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[22px] border border-destructive/20 bg-destructive/5 p-6 text-center" data-testid="status-error">
      <p className="font-display text-lg font-bold">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">Give it another beat, then try again.</p>
      {onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-4 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background">Retry</button>}
    </div>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-border bg-card/70 px-6 py-12 text-center" data-testid="status-empty">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary"><Sparkles className="h-5 w-5" /></div>
      <p className="mt-4 font-display text-xl font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const user = session.user;
  const nav = [
    { href: '/', label: 'Home', icon: <Compass className="h-[18px] w-[18px]" /> },
    { href: '/discover', label: 'Discover', icon: <Sparkles className="h-[18px] w-[18px]" /> },
    { href: '/notifications', label: 'Notifications', icon: <Bell className="h-[18px] w-[18px]" /> },
    { href: '/settings', label: 'Settings', icon: <Settings className="h-[18px] w-[18px]" /> },
  ];
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() }); setLocation('/login'); } });
  return (
    <div className="app-noise min-h-[100dvh] bg-background text-foreground">
      <aside className="sidebar-dots fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground lg:flex">
        <Logo />
        <div className="mt-12 rounded-[22px] border border-sidebar-border bg-sidebar-accent/70 p-4">
          <div className="flex items-center gap-3"><Avatar user={user} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name}</p><p className="truncate text-xs text-sidebar-foreground/60">@{user?.username}</p></div></div>
          <Link href={`/profile/${user?.username}`} data-testid="link-sidebar-profile" className="mt-4 flex items-center justify-between rounded-xl bg-sidebar-primary/15 px-3 py-2 text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-primary/25">View profile <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <nav className="mt-7 space-y-1" aria-label="Main navigation">
          {nav.map((item) => <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase()}`} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold ${location === item.href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>{item.icon}<span>{item.label}</span>{item.label === 'Notifications' && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}</Link>)}
        </nav>
        <div className="mt-auto">
          <div className="mb-5 rounded-2xl bg-secondary p-4 text-foreground"><p className="font-display text-lg font-bold leading-tight">Make a little<br />room for good.</p><p className="mt-2 text-xs leading-relaxed text-foreground/65">Your corner of campus, online.</p></div>
          <button data-testid="button-logout" onClick={handleLogout} disabled={logout.isPending} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut className="h-[18px] w-[18px]" /> {logout.isPending ? 'Leaving…' : 'Sign out'}</button>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Logo compact />
        <div className="flex items-center gap-2"><Link href="/notifications" data-testid="link-mobile-notifications" className="rounded-xl p-2 hover:bg-muted"><Bell className="h-5 w-5" /></Link><Link href={`/profile/${user?.username}`} data-testid="link-mobile-profile"><Avatar user={user} size="sm" /></Link></div>
      </header>
      <main className="lg:pl-[238px]">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-[68px] items-center justify-around border-t border-border bg-card/95 px-3 backdrop-blur-md lg:hidden">
        {nav.slice(0, 3).map((item) => <Link key={item.href} href={item.href} data-testid={`link-mobile-nav-${item.label.toLowerCase()}`} className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[10px] font-bold ${location === item.href ? 'text-primary' : 'text-muted-foreground'}`}>{item.icon}<span>{item.label}</span></Link>)}
        <Link href="/settings" data-testid="link-mobile-settings" className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[10px] font-bold ${location === '/settings' ? 'text-primary' : 'text-muted-foreground'}`}><Settings className="h-[18px] w-[18px]" /><span>Settings</span></Link>
      </nav>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-[100dvh] overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="absolute -right-24 -top-32 h-[440px] w-[440px] rounded-full bg-primary opacity-80 blur-3xl" />
      <div className="absolute bottom-[-180px] left-[-100px] h-[420px] w-[420px] rounded-full bg-accent opacity-50 blur-3xl" />
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-16"><Logo /><div className="flex items-center gap-3 text-sm"><span className="hidden text-sidebar-foreground/60 sm:inline">Already here?</span><Link href="/login" data-testid="link-landing-login" className="rounded-xl border border-sidebar-border px-4 py-2 font-bold hover:bg-sidebar-accent">Sign in</Link></div></header>
      <main className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-16 px-6 pb-20 pt-16 sm:px-10 lg:grid-cols-[1.1fr_.9fr] lg:px-16 lg:pt-24">
        <section className="animate-rise-in"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/70 px-3 py-1.5 text-xs font-bold tracking-wide text-secondary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Your people are here</div><h1 className="font-display text-[clamp(3.5rem,8vw,7.4rem)] font-bold leading-[.9] tracking-[-.075em] text-balance">A place to<br /><span className="text-primary">become</span> known.</h1><p className="mt-8 max-w-[480px] text-lg leading-relaxed text-sidebar-foreground/65">ConnectHub is the warm corner of the internet for campus life, new ideas, and the people who make both worth showing up for.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/register" data-testid="link-landing-register" className="group flex items-center gap-3 rounded-2xl bg-primary px-5 py-3.5 font-bold text-primary-foreground shadow-[5px_5px_0_hsl(var(--secondary))] hover:translate-y-[-2px]">Create your account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link><Link href="/discover" data-testid="link-landing-discover" className="rounded-2xl border border-sidebar-border px-5 py-3.5 font-bold hover:bg-sidebar-accent">See what’s happening</Link></div></section>
        <section className="relative mx-auto w-full max-w-[450px] animate-pop-in"><div className="absolute -inset-8 rounded-[40px] border border-primary/15 rotate-3" /><div className="relative rotate-[-3deg] rounded-[28px] bg-card p-5 text-foreground shadow-2xl"><div className="flex items-center justify-between border-b border-border pb-4"><div className="flex items-center gap-2.5"><Avatar user={{ id: 1, name: 'Maya Chen', username: 'mayac', avatarUrl: null, bio: null }} size="sm" /><div><p className="text-sm font-bold">Maya Chen</p><p className="text-xs text-muted-foreground">@mayac · 12m</p></div></div><MoreHorizontal className="h-5 w-5 text-muted-foreground" /></div><p className="py-5 font-display text-[26px] font-bold leading-tight">“The best ideas happen between classes.”</p><div className="relative h-48 overflow-hidden rounded-2xl bg-secondary"><div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border-[28px] border-primary" /><div className="absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-accent" /><div className="absolute bottom-5 left-5 font-display text-4xl font-bold text-foreground/80">say<br />more.</div></div><div className="flex items-center justify-between pt-4 text-muted-foreground"><span className="flex items-center gap-2 text-sm"><Heart className="h-4 w-4 fill-primary text-primary" /> 48 hearts</span><span className="text-sm">12 replies</span></div></div><div className="absolute -bottom-8 -left-8 rounded-2xl bg-secondary px-4 py-3 shadow-xl"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-foreground/55">This week</p><p className="font-display text-xl font-bold">2,840 new hellos</p></div></section>
      </main>
    </div>
  );
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [, setLocation] = useLocation();
  const mutation = mode === 'login' ? useLogin() : useRegister();
  const isLogin = mode === 'login';
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!form.email || !form.password || (!isLogin && (!form.name || !form.username))) { setError('Fill in the essentials so we can get you in.'); return; }
    const data = isLogin ? { email: form.email, password: form.password } : form;
    mutation.mutate({ data } as never, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() }); setLocation('/'); }, onError: () => setError('That didn’t land. Check your details and try again.') });
  };
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[.85fr_1.15fr]"><section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-primary/25 blur-3xl" /><Logo /><div className="relative"><p className="mb-4 text-sm font-bold uppercase tracking-[.18em] text-secondary">A better kind of social</p><h1 className="max-w-md font-display text-6xl font-bold leading-[.92] tracking-[-.06em]">Find your<br /><span className="text-primary">next person.</span></h1><p className="mt-6 max-w-sm leading-relaxed text-sidebar-foreground/65">A trusted home feed for the people, projects, and conversations that make your campus feel smaller.</p></div><p className="text-xs text-sidebar-foreground/40">ConnectHub · made for good company</p></section><section className="flex items-center justify-center px-6 py-10"><div className="w-full max-w-[430px]"><div className="mb-10 lg:hidden"><Logo /></div><div className="mb-8"><p className="text-sm font-bold uppercase tracking-[.15em] text-primary">{isLogin ? 'Welcome back' : 'Start here'}</p><h2 className="mt-2 font-display text-4xl font-bold tracking-[-.05em]">{isLogin ? 'Good to see you.' : 'Make your corner.'}</h2><p className="mt-2 text-muted-foreground">{isLogin ? 'Your people have been waiting.' : 'It only takes a minute to join the room.'}</p></div><form onSubmit={submit} className="space-y-4">{!isLogin && <div><label className="mb-1.5 block text-sm font-bold">Name</label><input data-testid="input-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="What should we call you?" /></div>}{!isLogin && <div><label className="mb-1.5 block text-sm font-bold">Username</label><input data-testid="input-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })} className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="your_handle" /></div>}<div><label className="mb-1.5 block text-sm font-bold">Email</label><input data-testid="input-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="you@campus.edu" /></div><div><label className="mb-1.5 block text-sm font-bold">Password</label><input data-testid="input-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder={isLogin ? 'Your password' : 'At least 8 characters'} /></div>{error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" data-testid="status-auth-error">{error}</p>}<button data-testid="button-auth-submit" disabled={mutation.isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground shadow-[3px_3px_0_hsl(var(--secondary))] hover:translate-y-[-1px] disabled:opacity-60">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? 'Sign in' : 'Create account'}{!mutation.isPending && <ArrowRight className="h-4 w-4" />}</button></form><p className="mt-7 text-center text-sm text-muted-foreground">{isLogin ? 'New around here?' : 'Already have an account?'} <Link href={isLogin ? '/register' : '/login'} data-testid="link-auth-switch" className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4">{isLogin ? 'Create an account' : 'Sign in'}</Link></p></div></section></div>
  );
}

function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const qc = useQueryClient();
  const like = useLikePost(); const unlike = useUnlikePost(); const comment = useCreateComment();
  const [liked, setLiked] = useState(post.isLiked); const [likes, setLikes] = useState(post.likesCount); const [showComments, setShowComments] = useState(false); const [commentText, setCommentText] = useState(''); const [saved, setSaved] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  const commentsQuery = useGetComments(post.id, { query: { enabled: showComments, queryKey: getGetCommentsQueryKey(post.id) } });
  const toggleLike = () => { const next = !liked; setLiked(next); setLikes((value) => value + (next ? 1 : -1)); const mutation = next ? like : unlike; mutation.mutate({ postId: post.id }, { onSuccess: (result) => { setLikes(result.likesCount); qc.invalidateQueries({ queryKey: getGetFeedQueryKey() }); qc.invalidateQueries({ queryKey: getGetDiscoverQueryKey() }); } }); };
  const submitComment = (event: FormEvent) => { event.preventDefault(); if (!commentText.trim()) return; comment.mutate({ postId: post.id, data: { content: commentText.trim() } }, { onSuccess: () => { setCommentText(''); setShowComments(true); qc.invalidateQueries({ queryKey: getGetCommentsQueryKey(post.id) }); qc.invalidateQueries({ queryKey: getGetFeedQueryKey() }); } }); };
  return (
    <article className={`feed-card rounded-[22px] border border-card-border bg-card p-5 ${compact ? 'p-4' : ''} animate-rise-in`} data-testid={`card-post-${post.id}`}>
      <div className="relative flex items-start justify-between"><Link href={`/profile/${post.author.username}`} data-testid={`link-post-author-${post.id}`} className="flex min-w-0 items-center gap-3"><Avatar user={post.author} size="md" /><div className="min-w-0"><p className="truncate text-sm font-bold">{post.author.name}</p><p className="truncate text-xs text-muted-foreground">@{post.author.username} <span className="mx-1">·</span> {formatDate(post.createdAt)}</p></div></Link><button data-testid={`button-post-more-${post.id}`} onClick={() => setMenuOpen((open) => !open)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-5 w-5" /></button>{menuOpen && <div className="absolute right-0 top-8 z-10 w-36 rounded-xl border border-border bg-card p-1.5 shadow-xl"><button data-testid={`button-copy-post-${post.id}`} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/profile/${post.author.username}`); setMenuOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted">Copy link</button></div>}</div>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7">{post.content}</p>
      {post.imageUrl && <img data-testid={`img-post-${post.id}`} src={post.imageUrl} alt="Post attachment" className="mt-4 max-h-[420px] w-full rounded-2xl object-cover" />}
      <div className="mt-4 flex items-center gap-1 border-t border-border pt-3"><button data-testid={`button-like-${post.id}`} onClick={toggleLike} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${liked ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}><Heart className={`h-[17px] w-[17px] ${liked ? 'fill-primary' : ''}`} />{likes}</button><button data-testid={`button-comments-${post.id}`} onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"><MessageCircle className="h-[17px] w-[17px]" />{post.commentsCount}</button><button data-testid={`button-bookmark-${post.id}`} onClick={() => setSaved((value) => !value)} className={`ml-auto rounded-xl p-2 ${saved ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted'}`}><Bookmark className={`h-[17px] w-[17px] ${saved ? 'fill-current' : ''}`} /></button></div>
      {showComments && <div className="mt-2 border-t border-border pt-3">{commentsQuery.isLoading ? <LoadingBlock className="h-12" /> : commentsQuery.isError ? <ErrorState message="Couldn’t load replies." onRetry={() => commentsQuery.refetch()} /> : <div className="space-y-3">{(commentsQuery.data || []).map((item: Comment) => <div key={item.id} className="flex gap-2.5"><Avatar user={item.author} size="sm" /><div className="rounded-2xl bg-muted px-3 py-2"><p className="text-xs font-bold">{item.author.name}</p><p className="mt-0.5 text-sm">{item.content}</p></div></div>)}</div>}<form onSubmit={submitComment} className="mt-3 flex items-center gap-2"><input data-testid={`input-comment-${post.id}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add something thoughtful…" className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" /><button data-testid={`button-submit-comment-${post.id}`} disabled={comment.isPending || !commentText.trim()} className="rounded-xl bg-foreground p-2 text-background disabled:opacity-40"><ArrowRight className="h-4 w-4" /></button></form></div>}
    </article>
  );
}

function PostComposer({ user }: { user: UserProfile | null }) {
  const qc = useQueryClient(); const create = useCreatePost(); const requestUpload = useRequestUploadUrl();
  const [content, setContent] = useState(''); const [imageUrl, setImageUrl] = useState(''); const [notice, setNotice] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!content.trim()) return; create.mutate({ data: { content: content.trim(), imageUrl: imageUrl || null } }, { onSuccess: () => { setContent(''); setImageUrl(''); setNotice('Posted to your corner.'); qc.invalidateQueries({ queryKey: getGetFeedQueryKey() }); qc.invalidateQueries({ queryKey: getGetMeQueryKey() }); setTimeout(() => setNotice(''), 2400); }, onError: () => setNotice('Couldn’t publish that just yet.') }); };
  const handleImage = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const valid = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']; if (!valid.includes(file.type) || file.size > 10485760) { setNotice('Use a JPG, PNG, WEBP, or GIF under 10MB.'); return; } requestUpload.mutate({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } }, { onSuccess: async (result) => { try { await fetch(result.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file }); setImageUrl(`/api/storage${result.objectPath}`); setNotice('Image attached.'); } catch { setNotice('Image upload failed.'); } } }); };
  return <form onSubmit={submit} className="rounded-[22px] border border-card-border bg-card p-5 feed-card" data-testid="form-create-post"><div className="flex gap-3"><Avatar user={user} size="md" /><textarea data-testid="input-post-content" value={content} onChange={(e) => setContent(e.target.value.slice(0, 1000))} rows={2} className="min-h-[78px] flex-1 resize-none bg-transparent pt-1 text-[15px] leading-6 outline-none placeholder:text-muted-foreground" placeholder="What’s on your mind today?" /></div>{imageUrl && <div className="mt-3 flex items-center justify-between rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"><span className="truncate">Image attached</span><button type="button" data-testid="button-remove-image" onClick={() => setImageUrl('')}><X className="h-4 w-4" /></button></div>}{notice && <p className="mt-3 text-xs font-bold text-accent" data-testid="status-post-notice">{notice}</p>}<div className="mt-3 flex items-center justify-between border-t border-border pt-3"><label data-testid="button-add-image" className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-bold text-muted-foreground hover:bg-muted"><ImageIcon className="h-[18px] w-[18px] text-accent" /> Add image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImage} className="hidden" /></label><button data-testid="button-submit-post" disabled={create.isPending || !content.trim()} className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-40">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Share</button></div></form>;
}

function RightRail({ discover }: { discover?: Discover }) {
  return <aside className="hidden xl:block"><div className="sticky top-8 space-y-5"><div className="rounded-[22px] bg-sidebar p-5 text-sidebar-foreground"><div className="flex items-center justify-between"><p className="font-display text-xl font-bold">People to know</p><Link href="/discover" data-testid="link-rail-discover" className="text-xs font-bold text-primary">See all</Link></div><div className="mt-4 space-y-4">{(discover?.suggestions || []).slice(0, 3).map((person) => <div key={person.id} className="flex items-center gap-3"><Avatar user={person} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{person.name}</p><p className="truncate text-xs text-sidebar-foreground/55">@{person.username}</p></div><Link href={`/profile/${person.username}`} data-testid={`link-rail-person-${person.id}`} className="rounded-lg border border-sidebar-border px-2 py-1 text-[11px] font-bold hover:bg-sidebar-accent">View</Link></div>)}</div></div><div className="rounded-[22px] border border-border bg-secondary/60 p-5"><p className="font-display text-xl font-bold">A small thought</p><p className="mt-2 text-sm leading-relaxed text-foreground/70">You don’t need a big audience. You need a few people who get it.</p><Link href="/discover" data-testid="link-rail-thought" className="mt-4 inline-flex items-center gap-1 text-xs font-bold">Find your people <ArrowRight className="h-3 w-3" /></Link></div></div></aside>;
}

function HomePage({ session }: { session: Session }) {
  const feed = useGetFeed({ limit: 20 }); const discover = useGetDiscover();
  return <PageFrame title="Good morning, {name}" eyebrow="Your home base" session={session}><div className="grid gap-7 xl:grid-cols-[minmax(0,650px)_280px]"><section className="space-y-4"><div className="mb-2 flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-primary">The latest</p><h1 className="font-display text-3xl font-bold tracking-[-.05em] sm:text-4xl">Your people, <span className="text-primary">in one place.</span></h1></div><button data-testid="button-feed-refresh" onClick={() => feed.refetch()} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><Loader2 className={`h-4 w-4 ${feed.isFetching ? 'animate-spin' : ''}`} /></button></div><PostComposer user={session.user} />{feed.isLoading ? <div className="space-y-4"><LoadingBlock className="h-48" /><LoadingBlock className="h-56" /></div> : feed.isError ? <ErrorState message="Your feed is taking a breather." onRetry={() => feed.refetch()} /> : feed.data?.items.length ? <div className="space-y-4">{feed.data.items.map((post) => <PostCard key={post.id} post={post} />)}</div> : <EmptyState title="Your feed is wide open." description="Follow a few people or share a first thought to start the conversation." action={<Link href="/discover" data-testid="link-empty-discover" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold">Discover people</Link>} />}</section><RightRail discover={discover.data} /></div></PageFrame>;
}

function PageFrame({ children, eyebrow, title, session }: { children: ReactNode; eyebrow?: string; title?: string; session: Session }) {
  const displayTitle = title?.replace('{name}', session.user?.name?.split(' ')[0] || 'there');
  return <div className="mx-auto min-h-[100dvh] max-w-[1180px] px-4 pb-24 pt-8 sm:px-7 lg:px-10 lg:pb-10 lg:pt-10"><div className="mb-8 flex items-start justify-between"><div>{eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}{displayTitle && <h1 className="font-display text-3xl font-bold tracking-[-.05em] sm:text-[40px]">{displayTitle}</h1>}</div><SearchBox /></div>{children}</div>;
}

function SearchBox() {
  const [, setLocation] = useLocation(); const [value, setValue] = useState(''); const [open, setOpen] = useState(false);
  const search = useSearchUsers({ q: value, limit: 5 }, { query: { enabled: value.length > 1, queryKey: getSearchUsersQueryKey({ q: value, limit: 5 }) } });
  return <div className="relative hidden w-[250px] sm:block"><div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2.5"><Search className="h-4 w-4 text-muted-foreground" /><input data-testid="input-search-users" value={value} onFocus={() => setOpen(true)} onChange={(e) => setValue(e.target.value)} placeholder="Find someone" className="w-full bg-transparent text-sm outline-none" /></div>{open && value.length > 1 && <div className="absolute left-0 right-0 top-12 z-30 rounded-2xl border border-border bg-card p-2 shadow-xl">{search.isLoading ? <LoadingBlock className="h-10" /> : search.data?.length ? search.data.map((person) => <button key={person.id} data-testid={`button-search-result-${person.id}`} onClick={() => setLocation(`/profile/${person.username}`)} className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-muted"><Avatar user={person} size="sm" /><span><b className="block text-sm">{person.name}</b><small className="text-muted-foreground">@{person.username}</small></span></button>) : <p className="p-3 text-xs text-muted-foreground">No one found yet.</p>}</div>}</div>;
}

function DiscoverPage({ session }: { session: Session }) {
  const discover = useGetDiscover(); const data = discover.data;
  return <PageFrame session={session} eyebrow="The wider room" title="Find your people."><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">{discover.isLoading ? <div className="space-y-4"><LoadingBlock className="h-56" /><LoadingBlock className="h-56" /></div> : discover.isError ? <ErrorState message="Discovery is taking a detour." onRetry={() => discover.refetch()} /> : <><section><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-accent">Right now</p><h2 className="font-display text-2xl font-bold">Trending conversations</h2></div><div className="rounded-xl bg-accent/10 px-3 py-2 text-xs font-bold text-accent">Fresh from campus</div></div><div className="space-y-4">{data?.trending?.length ? data.trending.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState title="No trends yet." description="Be the first person to start something worth talking about." />}</div></section><section><div className="rounded-[22px] border border-border bg-card p-5"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Suggested for you</h2></div><p className="mt-1 text-sm text-muted-foreground">People making interesting moves.</p><div className="mt-5 space-y-4">{data?.suggestions?.map((person) => <Suggestion key={person.id} person={person} />)}</div></div></section></>}</div></PageFrame>;
}

function Suggestion({ person }: { person: UserSummary }) {
  const qc = useQueryClient(); const follow = useFollowUser(); const unfollow = useUnfollowUser(); const [following, setFollowing] = useState(false);
  const toggle = () => { const next = !following; setFollowing(next); const mutation = next ? follow : unfollow; mutation.mutate({ username: person.username }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetDiscoverQueryKey() }); qc.invalidateQueries({ queryKey: getGetUserProfileQueryKey(person.username) }); } }); };
  return <div className="flex items-center gap-3"><Avatar user={person} size="md" /><div className="min-w-0 flex-1"><Link href={`/profile/${person.username}`} data-testid={`link-suggestion-${person.id}`} className="block truncate text-sm font-bold hover:text-primary">{person.name}</Link><p className="truncate text-xs text-muted-foreground">@{person.username}</p></div><button data-testid={`button-follow-${person.id}`} onClick={toggle} disabled={follow.isPending} className={`rounded-xl px-3 py-2 text-xs font-bold ${following ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'}`}>{following ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}</button></div>;
}

function ProfilePage({ session }: { session: Session }) {
  const { username = '' } = useParams<{ username: string }>(); const profile = useGetUserProfile(username); const posts = useGetUserPosts(username); const follow = useFollowUser(); const unfollow = useUnfollowUser(); const qc = useQueryClient(); const [following, setFollowing] = useState<boolean | null>(null);
  if (profile.isLoading) return <PageFrame session={session}><LoadingBlock className="h-48" /><LoadingBlock className="mt-5 h-64" /></PageFrame>;
  if (profile.isError || !profile.data) return <PageFrame session={session}><ErrorState message="That profile isn’t available." onRetry={() => profile.refetch()} /></PageFrame>;
  const person = profile.data; const isFollowing = following ?? person.isFollowing; const toggle = () => { const next = !isFollowing; setFollowing(next); const mutation = next ? follow : unfollow; mutation.mutate({ username }, { onSuccess: (result) => { setFollowing(result.following); qc.invalidateQueries({ queryKey: getGetUserProfileQueryKey(username) }); } }); };
  return <PageFrame session={session}><div className="overflow-hidden rounded-[26px] border border-border bg-card"><div className="h-28 bg-sidebar sm:h-36"><div className="h-full bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/.85),transparent_38%),radial-gradient(circle_at_85%_80%,hsl(var(--accent)/.7),transparent_34%)]" /></div><div className="px-5 pb-6 sm:px-8"><div className="-mt-10 flex items-end justify-between"><Avatar user={person} size="lg" /><button data-testid="button-profile-follow" onClick={toggle} className={`rounded-xl px-4 py-2 text-sm font-bold ${isFollowing ? 'border border-input bg-card' : 'bg-foreground text-background'}`}>{isFollowing ? 'Following' : 'Follow'}</button></div><div className="mt-4"><h1 className="font-display text-3xl font-bold tracking-[-.05em]">{person.name}</h1><p className="text-sm text-muted-foreground">@{person.username}</p><p className="mt-3 max-w-xl text-sm leading-6">{person.bio || 'Making things, meeting people, staying curious.'}</p><div className="mt-5 flex gap-7"><Stat label="Posts" value={person.postsCount} /><Stat label="Followers" value={person.followersCount} /><Stat label="Following" value={person.followingCount} /></div></div></div></div><div className="mt-8 max-w-[650px]"><p className="mb-4 text-sm font-bold uppercase tracking-[.16em] text-primary">Their corner</p>{posts.isLoading ? <LoadingBlock className="h-48" /> : posts.isError ? <ErrorState message="Posts could not load." onRetry={() => posts.refetch()} /> : posts.data?.items.length ? <div className="space-y-4">{posts.data.items.map((post) => <PostCard key={post.id} post={post} />)}</div> : <EmptyState title="Nothing posted yet." description="When they share something, it will live here." />}</div></PageFrame>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div><p className="font-display text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>; }
function formatDate(value: string) { const date = new Date(value); const diff = Date.now() - date.getTime(); if (diff < 60000) return 'now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`; return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

function NotificationsPage({ session }: { session: Session }) {
  const notifications = useGetNotifications({ limit: 50 }, { query: { queryKey: getGetNotificationsQueryKey({ limit: 50 }) } });
  return <PageFrame session={session} eyebrow="Keep in the loop" title="Notifications"><div className="max-w-[700px]">{notifications.isLoading ? <div className="space-y-3"><LoadingBlock className="h-20" /><LoadingBlock className="h-20" /><LoadingBlock className="h-20" /></div> : notifications.isError ? <ErrorState message="Notifications took a wrong turn." onRetry={() => notifications.refetch()} /> : notifications.data?.length ? <div className="overflow-hidden rounded-[22px] border border-border bg-card">{notifications.data.map((item) => <div key={item.id} className={`flex gap-3 border-b border-border p-5 last:border-0 ${item.read ? '' : 'bg-primary/5'}`} data-testid={`row-notification-${item.id}`}><div className="relative"><Avatar user={item.actor} size="md" />{!item.read && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />}</div><div className="flex-1"><p className="text-sm leading-6">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></div>{item.type === 'like' ? <Heart className="h-4 w-4 text-primary" /> : item.type === 'follow' ? <UserPlus className="h-4 w-4 text-accent" /> : <MessageCircle className="h-4 w-4 text-secondary-foreground" />}</div>)}</div> : <EmptyState title="All caught up." description="The good stuff will show up here when it happens." />}</div></PageFrame>;
}

function SettingsPage({ session }: { session: Session }) {
  const me = useGetMe(); const update = useUpdateMe(); const initializedForId = useRef<number | null>(null); const [form, setForm] = useState({ name: '', bio: '', avatarUrl: '' }); const [notice, setNotice] = useState('');
  useEffect(() => { if (me.data && initializedForId.current !== me.data.id) { initializedForId.current = me.data.id; setForm({ name: me.data.name, bio: me.data.bio || '', avatarUrl: me.data.avatarUrl || '' }); } }, [me.data]);
  const submit = (event: FormEvent) => { event.preventDefault(); update.mutate({ data: { name: form.name, bio: form.bio, avatarUrl: form.avatarUrl || null } }, { onSuccess: () => setNotice('Profile saved. Nice.') }); };
  return <PageFrame session={session} eyebrow="Make it yours" title="Profile settings"><div className="max-w-[720px]">{me.isLoading ? <LoadingBlock className="h-72" /> : me.isError ? <ErrorState message="We couldn’t open your settings." onRetry={() => me.refetch()} /> : <form onSubmit={submit} className="rounded-[22px] border border-border bg-card p-5 sm:p-7"><div className="flex items-center gap-4 border-b border-border pb-6"><Avatar user={me.data} size="lg" /><div><p className="font-display text-xl font-bold">{me.data?.name}</p><p className="text-sm text-muted-foreground">@{me.data?.username}</p></div></div><div className="mt-6 space-y-5"><div><label className="mb-1.5 block text-sm font-bold">Name</label><input data-testid="input-settings-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none focus:border-primary" /></div><div><label className="mb-1.5 block text-sm font-bold">Bio</label><textarea data-testid="input-settings-bio" rows={4} maxLength={160} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="w-full resize-none rounded-xl border border-input bg-background p-4 leading-6 outline-none focus:border-primary" placeholder="A line or two about what keeps you curious." /><p className="mt-1 text-right text-xs text-muted-foreground">{form.bio.length}/160</p></div><div><label className="mb-1.5 block text-sm font-bold">Avatar URL <span className="font-normal text-muted-foreground">(optional)</span></label><input data-testid="input-settings-avatar" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none focus:border-primary" placeholder="https://…" /></div></div>{notice && <p className="mt-5 text-sm font-bold text-accent" data-testid="status-settings-notice">{notice}</p>}<div className="mt-7 flex justify-end"><button data-testid="button-save-settings" disabled={update.isPending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">{update.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button></div></form>}</div></PageFrame>;
}

function AuthGate() {
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  if (session.isLoading) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="w-full max-w-sm space-y-4 px-6"><LoadingBlock className="mx-auto h-10 w-36" /><LoadingBlock className="h-36" /><LoadingBlock className="h-12" /></div></div>;
  if (session.isError || !session.data?.authenticated) return <Switch><Route path="/login" component={() => <AuthPage mode="login" />} /><Route path="/register" component={() => <AuthPage mode="register" />} /><Route component={Landing} /></Switch>;
  return <AppShell session={session.data}><Switch><Route path="/" component={() => <HomePage session={session.data!} />} /><Route path="/discover" component={() => <DiscoverPage session={session.data!} />} /><Route path="/profile/:username" component={() => <ProfilePage session={session.data!} />} /><Route path="/settings" component={() => <SettingsPage session={session.data!} />} /><Route path="/notifications" component={() => <NotificationsPage session={session.data!} />} /><Route component={NotFound} /></Switch></AppShell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><AuthGate /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;