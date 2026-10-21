# Session summary: Daedalus I, 2026-10-20 → 21

A plain-English record of this planning session for Minh: what got built, what we learned about the process, and
what changes from now on.

## What shipped
- **063 accuracy fixes** (live, e202a84): personal-care pages now say exactly what FDA and EU sources say. Built by
  Headsman I, the first builder Daedalus started on its own.
- **M17 cleaning products** (live, df2b7c8): EcoGo knows 799 EPA Safer Choice products. A listed cleaner shows a green
  card, EPA's "not an endorsement" line and California's ingredients-online rule. Built by Headsman II.
- **064 hidden risks** (almost done, Headsman III): an article on risks a label can't show, a benzene note on drinks,
  and a celery note on processed meats. Every check passes and no product's warning level changed. Waiting on your
  wording yes (to-do 1A), then the push.
- Fresh builders worked better: about 31% of their memory used at ship and one review round each, against 54% and
  two rounds for M16's long-lived builder.

## What your perfume test found
Three real bugs that had been live for a week: the photo reader glued or misread words at line ends and missed three
EU allergens; it kept warning text as ingredients; it said "not clear" on sharp photos. That became **066 Label reader
v2**, designed by you: clean the photo up, read it with a stronger free reader, and for any word it isn't sure of,
let the person tap one of three suggestions, type it, or retake the photo.

## What we learned about the process
- **Autopilot.** For about a week you approved the top option without reading. Rule calls are fine that way; taste
  calls slowly made the app more mine than yours (points & levels became a quieter counts page, personal care came
  before cleaners). Now every question is tagged 🔒 rule call or 🎨 your call, and on 🎨 calls you answer first.
- **Untested releases.** Four milestones shipped without your phone test. Now each milestone's test goes on your
  to-do list (docs/OWNER_TESTS.md), with a reminder every evening until you say "DONE 3B".
- **Drift.** New ideas pulled work away from unfinished features. Now Daedalus asks "now or later?" and parks later
  ideas in the Future features list (docs/MILESTONES.md).
- **Housekeeping.** Rule files only ever grew, the code map went stale and an unused connector loaded in every chat.
  The rulebook was rewritten (CLAUDE.md is about 40% smaller), notes got size limits, and a weekly maintenance task
  runs on Tuesdays.
- **Research behind it** (Anthropic): keep always-loaded files short; things that must always happen belong in
  automatic checks, not prose; fresh agents with notes beat long chats; multi-agent setups cost about 15× the tokens,
  so two agents (planner + builder) stay the setup.

## What to read (and what to skip)
- **Read:** the "In plain terms" line, any question with buttons, and the push ask. Skip the drop-down arrows (raw
  thinking and tool calls) and progress relays.
- **Before you say yes to a push**, three questions: Is it the list Daedalus checked? Does the plain-terms line make
  sense to you? Is there a 🎨 call in it you haven't seen? If all fine, yes is safe.
- **Commit** = saving a labelled snapshot of the work (safe, private until pushed). **Push** = sending those
  snapshots to GitHub's main copy, which **puts them live on the website** a minute later (the deploy). That's why
  only pushes need your careful yes. More words: docs/HOW_ECOGO_WORKS.md, "Words you'll see".

## How to work with Daedalus now
- **Dashboard:** the EcoGo Build Board (private link) shows the current status, your to-dos, the build map with work
  types, the weekly timeline, recent events and decisions. Leave a comment on it for suggestions or feedback;
  Daedalus reads them at each check-in. No second planner: decisions stay in one place.
- **Codes:** say "DONE 4C" when you finish a to-do. Say "now" or "later" when Daedalus asks about a new idea.
- **Daedalus rotates** to a fresh chat at about 50% memory, at a clean point (after 064 ships), using its handoff note.

## Next
064 goes live → refresh the code map → spec 066 Label reader v2 (it starts with a measured test of free readers on
your real label photos) → your next-chapter review picks Chapter 6.
