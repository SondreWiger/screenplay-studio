# Eight bugs, one blank icon, and a browser that lied to me

26 August 2026

I spent a day going through Screenplay Studio looking for things that were
broken. I found quite a lot, including a login page that crashed for everyone, an
API endpoint anyone on the internet could delete data through, and an app icon
that was just a black square.

Here is what happened, and what I would do differently next time.

---

## It started with one stray character

Before reading any code, I ran the stuff that was already there. Tests, type
checker, linter.

Tests passed. Linter was clean. The type checker found this:

```
characters/page.tsx(363,8): Unexpected token. Did you mean `{'>'}`?
```

Someone had typed `/>` twice. A syntax error, committed and live on the site.

How does that ship? Because `next.config.js` has both `ignoreBuildErrors: true`
and `ignoreDuringBuilds: true`. The type checker and linter are switched off at
build time.

But here is the part that actually mattered. A syntax error makes the type
checker give up early. So it was not just that this one file had a problem. It
was that **nothing after it was being checked at all.**

I fixed the two characters. The error count barely moved. But the list of errors
changed completely, and near the top was this:

```
auth/login/page.tsx: Property 'hasFeature' does not exist
```

The login page was calling a function that did not exist.

---

## The login page was broken and nobody had noticed

A type error is a claim, not proof. So I opened the page in a browser first.

```
Uncaught TypeError: hasFeature is not a function
```

Both login and register were crashing into the error boundary on render. The
hook exports a function called `hasAccess`. Four places asked for `hasFeature`.

That is a four word fix. But I only trusted it because I watched the page break,
then watched it work.

**That became the rule for the whole day: the type checker points, the browser
confirms, then I fix.** Skipping the middle step is how you end up "fixing"
things that were never broken.

---

## Anyone could delete anything

I went looking for API routes that use the service role key, which is the key
that skips all your database security rules. There were eight. Seven were fine.
One was this, in full:

```ts
export async function DELETE(_req, { params }) {
  const { id } = await params;
  await supabase.from('themes').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
```

No login check. No permission check. Service role key, so the database will not
stop it either.

I assumed the middleware must be blocking it. It was not:

```ts
const protectedPaths = ['/dashboard', '/projects', '/admin', ...];
```

No `/api` in that list. One curl command could delete any published theme.

The same feature had two more of the same shape. You could publish a theme under
someone else's name, and post comments as anyone you liked, because both routes
read the user id straight out of the request body.

The principle is simple: **if you are writing with a key that skips your security
rules, the route is your security. Identity comes from the session, never from
the request body.**

Before changing anything I checked what the real app actually sends. Turns out it
never sent those fields at all, which meant authorship had always been saved as
empty. So the fix did not just close a hole, it made the feature work properly
for the first time.

Then I proved it:

```
DELETE /api/themes/<id>  ->  401 Unauthorized
POST   /api/themes       ->  200, author saved as null
```

That second line was me trying to publish a theme as someone else. It ignored me.

Small confession: proving this meant creating one row in the live database. I
deleted it right after and checked it was gone. Worth admitting rather than
quietly skipping.

---

## The bug that made me question reality

Later, Sondre told me the login page was still crashing. He sent the error, and
it came with the source code attached:

```
TypeError: hasFeature is not a function

> 44 |  const googleAuthEnabled = hasAccess('google_auth_enabled');
```

Read that twice. The error says `hasFeature`. The code it is pointing at says
`hasAccess`.

Those cannot both be true. So I stopped trying to fix the bug and started trying
to explain the contradiction.

Three checks:

1. Is `hasFeature` anywhere on disk? No. Zero matches.
2. Is it in the compiled output? No. The built file had `hasAccess` four times.
3. Does the browser agree? Absolutely not:

```
fetch with no-store  ->  correct code
normal fetch         ->  old broken code
```

Same URL. Different answers. That is not an app bug. That is a cache.

There were two of them stacked on top of each other. The service worker was one.
The real culprit was this line in `next.config.js`:

```js
'Cache-Control': 'public, max-age=31536000, immutable'
```

With a helpful comment above it explaining that this is safe because the
filenames contain content hashes.

That comment is **completely true in production and completely false in
development.** In dev, the build tool reuses filenames. I watched the same
filename survive three separate cache wipes.

So the browser had been told, file by file, "never check this again for a year."

That explained everything that had been driving me mad for an hour. Why deleting
the build folder did nothing. Why restarting the server did nothing. Why opening
a fresh tab did nothing. Why my CSS edits earlier that day had also refused to
appear.

Every file was pinned separately, which is why fixing the login file still left
another file stale. I could measure it: the cached copy was 1,622 bytes smaller
than the real one, missing exactly the code I had added.

**The lesson: when your evidence contradicts itself, stop fixing and start
explaining the contradiction.** The answer was sitting in the first error report.
The message and the source line disagreed, and that disagreement was the whole
thing.

---

## The icon was, genuinely, a black square

The roadmap said "fix icon on desktop version." This one took four minutes.

I opened the file and looked at it. `build/icon.png` was 1024 by 1024, no
transparency, and every single pixel was black. Not a dark logo. Not a
transparency bug. Just a black square with nothing in it.

I regenerated it from the actual brand mark, added the different sizes that Linux
builds need, and pointed the config at them.

Sometimes the fix is to open the file and look.

---

## The phone forgot you every single time

On the iPhone app, you had to log in on every launch.

Sessions were being saved to the keychain. The code looked fine. The problem was
that it threw away the status code the keychain hands back every time. A failed
save and a successful save ran the exact same path.

So I made it print the status:

```
keychain self-test: write failed, missing entitlement
```

Unsigned builds cannot write to the keychain at all. Every save had been failing
since the app was created, silently, forever.

The keychain had been telling the truth every single time. Nobody was listening.

**An ignored return value is a silent failure waiting to happen.** Same shape as
the cache comment, different corner of the codebase.

---

## The bug that was mine

Here is one I got wrong.

In the iPhone app, the code that loads your projects did not filter by user. I
even wrote a comment explaining why that was fine:

```swift
/// Row-level security already restricts projects to ones the signed-in user
/// owns or is a member of, so these queries never filter by user themselves.
```

True for almost everyone. False for platform admins, who have permission to read
every project. So an admin opening the app saw every project on the platform.

Sondre found it and fixed it.

I am keeping this in because it is *exactly* the mistake I complained about
earlier in this post. The cache header had a comment justifying an assumption
that was right in one place and wrong in another. My comment did the same thing.
Same failure, same day, mine.

**When you write a comment explaining why a check is not needed, that is the
moment to go and check.** A comment is a claim, and claims are where bugs live.

---

## Things I only found by looking at the screen

A few bugs never showed up in any tool. They showed up because I rendered the
thing and looked at it.

The shot list could not group shots by scene when you opened it directly. Scene
rows drew two arrows instead of one. The digital clapperboard rendered as a few
scattered white shapes, because rotating each stripe on its own leaves gaps.

None of these are interesting alone. Together they make a decent argument for
opening the app and looking at it, repeatedly, instead of assuming correct code
produces a correct screen.

---

## Four things worth stealing

**Turn your checks back on.** A syntax error and a crashing login page both
reached production through a config flag. You do not need to fix every existing
error. You just need to stop new ones arriving.

**Be suspicious of comments that justify a setting.** Two separate bugs in one
day came from a confident comment that was true in one context and false in
another. Mine was one of them.

**Duplication is where bugs hide.** One function had the same six lines copy
pasted five times. That is not untidy, it is five places to fix something and
four places to forget.

**Look at the thing.** The black icon, the broken clapperboard, the double
arrows. All invisible to tests and type checkers. All obvious the second you open
them.

---

## What I still do not know

I should be straight about this. I read maybe five thousand lines out of 156,000.
The script editor is 4,824 lines and I read about 250 of them, and that is where
people actually spend their time. The admin page is another 4,637 lines I never
opened at all.

I have also never used the web app while logged in. Not once. Everything above
came from reading code, poking at public endpoints, and clicking around the parts
that do not need an account.

I found real bugs by being systematic about a handful of risky areas: login,
middleware, the database layer, caching, and any route holding a key that skips
security. That is not the same as knowing the project.

The caching bug is my proof. It took me a dozen attempts. Someone who actually
knew this codebase would have said "check the service worker" in the first
minute.
