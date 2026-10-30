// The account week by week, from its daily rows (account_daily): new followers,
// unfollows, net growth, views, profile visits, link taps. Pure, so the page,
// Edith and the weekly analysis read the same numbers.

export type DailyRow = {
  day: string; // YYYY-MM-DD
  followers: number | null;
  new_followers: number | null;
  unfollows: number | null;
  views: number | null;
  reach: number | null;
  profile_views: number | null;
  link_taps: number | null;
  interactions: number | null;
};

export type Week = {
  /** Monday of the week, YYYY-MM-DD. */
  start: string;
  newFollowers: number | null;
  unfollows: number | null;
  /** Gained minus lost; from the follower count when the detail is missing. */
  net: number | null;
  /** Followers at the end of the week (last count known). */
  followers: number | null;
  views: number | null;
  profileViews: number | null;
  linkTaps: number | null;
  interactions: number | null;
  /** Days with data in this week. */
  days: number;
};

const DAY_MS = 86_400_000;

/** Monday (UTC) of the week of a YYYY-MM-DD day. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
}

const add = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);

/** The last `count` weeks up to the week of `today` (oldest first), empty weeks included. */
export function weeklyGrowth(rows: DailyRow[], count: number, today: Date = new Date()): Week[] {
  const current = weekStart(today.toISOString().slice(0, 10));
  const starts = Array.from({ length: count }, (_, i) => new Date(new Date(`${current}T00:00:00Z`).getTime() - (count - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10));
  const byWeek = new Map<string, DailyRow[]>();
  for (const r of rows) byWeek.set(weekStart(r.day), [...(byWeek.get(weekStart(r.day)) ?? []), r]);
  // The follower count before each week: the last one known before it.
  const sorted = [...rows].filter((r) => r.followers !== null).sort((a, b) => a.day.localeCompare(b.day));
  const lastBefore = (day: string) => [...sorted].reverse().find((r) => r.day < day)?.followers ?? null;
  return starts.map((start) => {
    const list = (byWeek.get(start) ?? []).sort((a, b) => a.day.localeCompare(b.day));
    const week: Week = { start, newFollowers: null, unfollows: null, net: null, followers: null, views: null, profileViews: null, linkTaps: null, interactions: null, days: list.length };
    for (const r of list) {
      week.newFollowers = add(week.newFollowers, r.new_followers);
      week.unfollows = add(week.unfollows, r.unfollows);
      week.views = add(week.views, r.views);
      week.profileViews = add(week.profileViews, r.profile_views);
      week.linkTaps = add(week.linkTaps, r.link_taps);
      week.interactions = add(week.interactions, r.interactions);
      if (r.followers !== null) week.followers = r.followers;
    }
    if (week.newFollowers !== null) week.net = week.newFollowers - (week.unfollows ?? 0);
    else {
      const before = lastBefore(start);
      if (week.followers !== null && before !== null) week.net = week.followers - before;
    }
    return week;
  });
}

/** Totals over the days since `from` (YYYY-MM-DD, included). */
export function periodTotals(rows: DailyRow[], from: string) {
  const list = rows.filter((r) => r.day >= from).sort((a, b) => a.day.localeCompare(b.day));
  const sum = (key: keyof DailyRow) => list.reduce<number | null>((acc, r) => add(acc, r[key] as number | null), null);
  const counts = list.filter((r) => r.followers !== null);
  const before = [...rows].filter((r) => r.day < from && r.followers !== null).sort((a, b) => b.day.localeCompare(a.day))[0]?.followers ?? null;
  const last = counts.at(-1)?.followers ?? null;
  const newFollowers = sum("new_followers");
  const unfollows = sum("unfollows");
  return {
    newFollowers,
    unfollows,
    net: newFollowers !== null ? newFollowers - (unfollows ?? 0) : last !== null && before !== null ? last - before : null,
    followers: last,
    views: sum("views"),
    profileViews: sum("profile_views"),
    linkTaps: sum("link_taps"),
    interactions: sum("interactions"),
    days: list.length,
  };
}

export type PostStat = {
  kind: string;
  publishedAt: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  /** Visits to her profile from this post: the first step towards a booking. */
  profileVisits?: number | null;
};

/** Signs that someone may become a client: profile visits, saves and shares, over the accounts reached. */
const interestOf = (p: PostStat) => (p.reach ? ((p.profileVisits ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)) / p.reach : null);

/**
 * Average per post for each format: profile visits, saves, shares, views, the
 * interest rate (visits, saves and shares over reach: what brings clients, not
 * likes) and the engagement rate. Best interest first.
 */
export function byFormat(posts: PostStat[]) {
  const groups = new Map<string, PostStat[]>();
  for (const p of posts) groups.set(p.kind, [...(groups.get(p.kind) ?? []), p]);
  return [...groups.entries()]
    .map(([kind, list]) => {
      const avg = (key: "views" | "reach" | "likes" | "comments" | "saves" | "shares" | "profileVisits") => {
        const known = list.map((p) => p[key] ?? null).filter((v): v is number => v !== null);
        return known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
      };
      const rated = list.filter((p) => p.reach);
      const mean = (f: (p: PostStat) => number) => (rated.length ? rated.reduce((acc, p) => acc + f(p), 0) / rated.length : null);
      const engagement = mean((p) => ((p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)) / p.reach!);
      const interest = mean((p) => interestOf(p)!);
      return {
        kind,
        posts: list.length,
        views: avg("views"),
        reach: avg("reach"),
        likes: avg("likes"),
        comments: avg("comments"),
        saves: avg("saves"),
        shares: avg("shares"),
        profileVisits: avg("profileVisits"),
        interest,
        engagement,
      };
    })
    .sort((a, b) => (b.interest ?? -1) - (a.interest ?? -1) || (b.views ?? b.reach ?? 0) - (a.views ?? a.reach ?? 0));
}

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Posts with a known number of profile visits from this many on: moments are ranked by visits, not views. */
const VISITS_FROM = 3;

/**
 * The best moments to post, in the studio's time zone: by weekday and by time of
 * day, ranked by profile visits (what leads to a booking) when the posts give
 * them, else by views. `by` says which.
 */
export function bestMoments(posts: PostStat[], timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", hourCycle: "h23" });
  const by: "visits" | "views" = posts.filter((p) => p.publishedAt && p.profileVisits != null).length >= VISITS_FROM ? "visits" : "views";
  const score = (p: PostStat) => (by === "visits" ? (p.profileVisits ?? null) : (p.views ?? p.reach));
  const days = new Map<number, number[]>();
  const slots = new Map<string, number[]>();
  for (const p of posts) {
    const value = score(p);
    if (!p.publishedAt || value === null) continue;
    const parts = Object.fromEntries(fmt.formatToParts(new Date(p.publishedAt)).map((x) => [x.type, x.value]));
    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday ?? "");
    const hour = Number(parts.hour);
    const slot = hour < 11 ? "le matin" : hour < 14 ? "le midi" : hour < 18 ? "l'après-midi" : "le soir";
    if (weekday >= 0) days.set(weekday, [...(days.get(weekday) ?? []), value]);
    slots.set(slot, [...(slots.get(slot) ?? []), value]);
  }
  const mean = (list: number[]) => Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  return {
    by,
    days: [...days.entries()].map(([d, list]) => ({ label: WEEKDAYS[d]!, posts: list.length, average: mean(list) })).sort((a, b) => b.average - a.average),
    slots: [...slots.entries()].map(([label, list]) => ({ label, posts: list.length, average: mean(list) })).sort((a, b) => b.average - a.average),
  };
}

/** Enough posts to suggest a moment: fewer and the ranking is chance. */
export const MOMENT_ADVICE_FROM = 5;

/**
 * Her own best moment to post, in one line (« le mardi, le soir »), when she has
 * enough posts and the best day was seen at least twice; null otherwise.
 */
export function suggestedMoment(moments: ReturnType<typeof bestMoments>): string | null {
  const posts = moments.days.reduce((n, d) => n + d.posts, 0);
  const day = moments.days.find((d) => d.posts >= 2);
  if (posts < MOMENT_ADVICE_FROM || !day) return null;
  const slot = moments.slots.find((s) => s.posts >= 2);
  return slot ? `le ${day.label}, ${slot.label}` : `le ${day.label}`;
}

export type FollowerPoint = { day: string; followers: number; counted: boolean };

/**
 * The follower count day by day over the last `days` days. Counts read on the
 * account are kept; between them, and before the first one, each day is worked
 * back from the next day's count minus that day's gains and losses (Instagram
 * gives those for the past 30 days, so the curve has a month on day one).
 * `counted`: a count read on the account, not worked back.
 */
export function followerSeries(rows: DailyRow[], days: number, today: Date = new Date()): FollowerPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const end = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`).getTime() - DAY_MS;
  const points: FollowerPoint[] = [];
  let next: number | null = null; // the count at the end of the day after
  for (let t = end; t > end - days * DAY_MS; t -= DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(day);
    let count: number | null = null;
    let counted = false;
    if (row?.followers != null) {
      count = row.followers;
      counted = true;
    } else if (next !== null) {
      // The end of this day = the end of the next day minus the next day's net.
      const after = byDay.get(new Date(t + DAY_MS).toISOString().slice(0, 10));
      if (after?.new_followers != null) count = next - (after.new_followers - (after.unfollows ?? 0));
    }
    if (count === null) {
      next = null;
      continue;
    }
    points.push({ day, followers: Math.max(0, count), counted });
    next = count;
  }
  return points.reverse();
}

/** A video of her public profile, with its numbers (public_videos): what her @ shows of it. */
export type PublicVideoStat = { views: number | null; likes: number | null; comments: number | null; saves?: number | null };

/** Interactions over views (likes, comments and saves for each view), the engagement of a Reel; null without views. */
export function engagementOf(video: PublicVideoStat): number | null {
  if (!video.views) return null;
  return ((video.likes ?? 0) + (video.comments ?? 0) + (video.saves ?? 0)) / video.views;
}

/**
 * One platform's videos over a period: how many, their views, likes and comments, the average views
 * per video, the engagement over all of them (interactions over views), and how far a video goes
 * compared with her followers (average views over followers: above 1, beyond them).
 */
export function platformSummary(videos: PublicVideoStat[], followers: number | null) {
  const total = (pick: (v: PublicVideoStat) => number | null | undefined) => {
    const known = videos.map(pick).filter((n): n is number => typeof n === "number");
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
  };
  const counted = videos.filter((v) => v.views !== null);
  const views = total((v) => v.views);
  const interactions = counted.reduce((a, v) => a + (v.likes ?? 0) + (v.comments ?? 0) + (v.saves ?? 0), 0);
  const perVideo = counted.length && views !== null ? Math.round(views / counted.length) : null;
  return {
    videos: videos.length,
    views,
    likes: total((v) => v.likes),
    comments: total((v) => v.comments),
    perVideo,
    engagement: views ? interactions / views : null,
    reach: perVideo !== null && followers ? perVideo / followers : null,
  };
}

/** A video's views on one day (public_video_days, read from her @ each day). */
export type ViewSnapshot = { platform: string; video_id: string; day: string; views: number | null };
/** A video of her profile and the day it went online. */
export type PublishedVideo = { platform: string; video_id: string; published_at: string };
/** Seven days of her public profiles, all platforms given together. */
export type PublicWeek = {
  /** The day before the week (excluded) and its last day (included), YYYY-MM-DD. */
  start: string;
  end: string;
  /** Videos put online during the week. */
  videos: number;
  /** Views her recent videos gained during the week; null while the history does not reach its start. */
  views: number | null;
  /** Followers gained minus lost over the week; null without a count on both ends. */
  net: number | null;
  /** Followers at the end of the week (last count known). */
  followers: number | null;
};

const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The last row on or before `day` (rows sorted by day). */
function onOrBefore<T extends { day: string }>(rows: T[], day: string): T | undefined {
  let found: T | undefined;
  for (const r of rows) {
    if (r.day > day) break;
    found = r;
  }
  return found;
}

/**
 * Views her videos gained between two days (after `from`, up to `to` included): each video's views
 * on the last snapshot up to `to`, minus those on the last one up to `from` (0 for a video put online
 * since). A video's total alone says nothing of a week: last week's Reel has more views than
 * Tuesday's only for being older. Null while no snapshot reaches `from`.
 */
export function viewsGained(snapshots: ViewSnapshot[], videos: PublishedVideo[], from: string, to: string): number | null {
  if (!snapshots.some((s) => s.day <= from)) return null;
  const online = new Map(videos.map((v) => [`${v.platform}:${v.video_id}`, v.published_at.slice(0, 10)]));
  const byVideo = new Map<string, ViewSnapshot[]>();
  for (const s of [...snapshots].sort((a, b) => a.day.localeCompare(b.day))) {
    if (s.views === null) continue;
    const key = `${s.platform}:${s.video_id}`;
    byVideo.set(key, [...(byVideo.get(key) ?? []), s]);
  }
  let total = 0;
  for (const [key, list] of byVideo) {
    const end = onOrBefore(list, to);
    if (!end || end.day <= from) continue;
    const start = onOrBefore(list, from);
    const since = online.get(key);
    const base = start ? start.views! : since && since > from ? 0 : null;
    if (base === null) continue;
    total += Math.max(0, end.views! - base);
  }
  return total;
}

/**
 * Her last `count` weeks of seven days ending on `today` (oldest first), from her @: the videos she
 * put online, the views they gained, her followers gained or lost. The Sunday report compares the
 * last one with the one before (Tristan: « vs la semaine précédente hein ? »).
 */
export function publicWeeks(input: {
  snapshots: ViewSnapshot[];
  videos: PublishedVideo[];
  days: (DailyRow & { platform: string })[];
  today: string;
  count: number;
}): PublicWeek[] {
  const counts = new Map<string, DailyRow[]>();
  for (const d of [...input.days].filter((r) => r.followers !== null).sort((a, b) => a.day.localeCompare(b.day))) {
    counts.set(d.platform, [...(counts.get(d.platform) ?? []), d]);
  }
  const followersOn = (day: string) => {
    let sum: number | null = null;
    for (const list of counts.values()) sum = add(sum, onOrBefore(list, day)?.followers ?? null);
    return sum;
  };
  return Array.from({ length: input.count }, (_, i) => {
    const end = shiftDay(input.today, -7 * (input.count - 1 - i));
    const start = shiftDay(end, -7);
    let net: number | null = null;
    for (const list of counts.values()) {
      const a = onOrBefore(list, start)?.followers;
      const b = onOrBefore(list, end);
      if (a != null && b && b.day > start && b.followers !== null) net = add(net, b.followers - a);
    }
    return {
      start,
      end,
      videos: input.videos.filter((v) => {
        const day = v.published_at.slice(0, 10);
        return day > start && day <= end;
      }).length,
      views: viewsGained(input.snapshots, input.videos, start, end),
      net,
      followers: followersOn(end),
    };
  });
}
