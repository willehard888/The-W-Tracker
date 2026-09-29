#!/usr/bin/env python3
"""The badge catalogue, as code. Prints the SQL that makes production match it.

    python3 scripts/badge-catalog.py > supabase/migrations/<stamp>_badge_ladders.sql

One entry per badge: (value, name, icon, description). Rarity comes from the
rung's place on its ladder — the horizon is Mythic (stored as `legendary`),
the two rungs under it Epic, the middle Rare, the first two Common — except
where a track sets it by hand. Renames are UPDATEs by the old name (a badge
is its row; members keep what they earned), deletions are explicit, and the
upsert keys on name, so a name here is a promise.

The ladder rule: one Mythic per track, years away; the rungs before it close
enough to feel. Names carry meaning, not the number.
"""
import sys

# (key, category, rungs, rarity_override?) — rungs are (value, name, icon, description)
LADDERS = [
    ("checkins", "checkin", [
        (1, "First Step", "👣", "Your first check-in. The day is on the record."),
        (10, "Ten Days", "📋", "Ten days logged."),
        (25, "Consistent", "📊", "Twenty-five days. This is a habit now."),
        (50, "Fifty", "📝", "Fifty days logged."),
        (75, "Devoted", "🔒", "Seventy-five days on the record."),
        (100, "Century", "💯", "A hundred days logged."),
        (200, "Unstoppable", "🚀", "Two hundred days. Nothing has stopped you."),
        (500, "Five Hundred", "🗓️", "Five hundred days logged."),
        (1000, "Eternal", "♾️", "A thousand days on the record."),
    ]),
    ("longest_streak", "streak", [
        (3, "First Spark", "🔥", "Three days in a row. The fire is lit."),
        (7, "Week Warrior", "⚡", "Seven days without a gap."),
        (14, "Fortnight Force", "💫", "Fourteen days in a row."),
        (30, "Thirty", "💎", "Thirty days without a gap."),
        (60, "Dynasty", "🏛️", "Sixty days in a row."),
        (90, "Ninety", "🐉", "Ninety days without a gap. You are the habit."),
        (100, "Hundred", "🗿", "A hundred consecutive days."),
        (180, "Half Year", "🌓", "A hundred and eighty days in a row."),
        (365, "Year of Steel", "⭐", "A whole year without a gap."),
        (1000, "Unbroken", "⛓️", "A thousand consecutive days."),
    ]),
    ("meditation", "discipline", [
        (1, "First Breath", "🌬️", "Your first meditation session."),
        (10, "Inner Peace", "☮️", "Ten sessions."),
        (30, "Mind Over Matter", "🧠", "Thirty sessions."),
        (50, "Zen Master", "🧘", "Fifty sessions."),
        (100, "Still Mind", "🪷", "A hundred sessions."),
        (200, "Deep Water", "🌌", "Two hundred sessions."),
        (300, "Enlightened", "✨", "Three hundred sessions. Morning and evening both count."),
    ]),
    ("meditation_streak", "discipline", [
        (14, "Iron Mind", "🧠", "Fourteen days of meditation without missing one."),
        (30, "Unmoved", "🗻", "Thirty days of meditation in a row."),
        (100, "Stillness", "🕯️", "A hundred days of meditation without a gap."),
    ]),
    ("level", "level", [
        (3, "Apprentice", "🎖️", "Level 3."),
        (5, "Journeyman", "⭐", "Level 5."),
        (10, "Warrior", "⚔️", "Level 10."),
        (15, "Veteran", "🌟", "Level 15."),
        (25, "Champion", "🏅", "Level 25."),
        (30, "Master", "💫", "Level 30."),
        (50, "Grandmaster", "♔", "Level 50. The highest order."),
    ]),
    ("xp", "xp", [
        (500, "Rising Star", "⭐", "500 XP."),
        (1000, "First 1K", "🎯", "1,000 XP."),
        (2000, "XP Collector", "💰", "2,000 XP."),
        (5000, "XP Machine", "🔥", "5,000 XP."),
        (10000, "10K Club", "🏅", "10,000 XP."),
        (25000, "XP Overlord", "🔮", "25,000 XP."),
        (50000, "XP Immortal", "💀", "50,000 XP."),
        (100000, "100K Legend", "👑", "100,000 XP. Around a thousand full days."),
    ]),
    ("workouts", "sport", [
        (1, "First Sweat", "💦", "Your first workout logged."),
        (20, "Gym Regular", "🏋️", "Twenty workouts."),
        (50, "Gym Rat", "🏋️", "Fifty workouts."),
        (100, "Beast Mode", "🐺", "A hundred workouts."),
        (250, "Titan of Iron", "🗡️", "Two hundred and fifty workouts."),
        (500, "Forged", "🔨", "Five hundred workouts."),
        (1000, "Iron Immortal", "⚙️", "A thousand workouts."),
    ]),
    ("double_workout", "sport", [
        (1, "Double Down", "💪", "Two workouts in one day."),
        (5, "Double Trouble", "⚡", "Five double days."),
        (20, "Overachiever", "🎯", "Twenty double days."),
        (50, "Twice a Day", "⏫", "Fifty days with two workouts."),
    ]),
    ("cold_shower", "discipline", [
        (1, "Ice Breaker", "❄️", "Your first cold shower logged."),
        (5, "First Chill", "🥶", "Five cold showers."),
        (10, "Cold Warrior", "🧊", "Ten cold showers."),
        (30, "Polar Bear", "🐻‍❄️", "Thirty cold showers."),
        (50, "Arctic Soul", "❄️", "Fifty cold showers."),
        (100, "Frost King", "🧊", "A hundred cold showers."),
        (200, "Absolute Zero", "🧊", "Two hundred cold showers."),
        (500, "Permafrost", "🌨️", "Five hundred cold showers."),
    ]),
    ("reading", "discipline", [
        (1, "First Chapter", "📖", "Your first reading session."),
        (10, "Bookworm", "📚", "Ten reading sessions."),
        (30, "Knowledge Seeker", "🔍", "Thirty reading sessions."),
        (75, "Scholar", "🎓", "Seventy-five reading sessions."),
        (150, "Library Legend", "🏛️", "A hundred and fifty reading sessions."),
        (365, "Lifelong", "📜", "Three hundred and sixty-five reading sessions."),
    ]),
    ("healthy_food", "discipline", [
        (1, "First Clean Meal", "🥦", "Your first clean day logged."),
        (30, "Clean Eater", "🥗", "Thirty clean days."),
        (50, "Nutrition Nerd", "🧬", "Fifty clean days."),
        (100, "Diet King", "👑", "A hundred clean days."),
        (365, "Clean Year", "🥬", "Three hundred and sixty-five clean days."),
    ]),
    ("protein", "discipline", [
        (20, "Protein Beast", "🥩", "Protein target hit twenty days."),
        (50, "Protein Machine", "🥩", "Fifty days on target."),
        (100, "Protein Titan", "🏆", "A hundred days on target."),
        (365, "Protein Year", "🍗", "Three hundred and sixty-five days on target."),
    ]),
    ("hydration", "discipline", [
        (30, "Hydration King", "💧", "Three litres or more, thirty days."),
        (60, "Ocean Inside", "🌊", "Sixty days at three litres."),
        (100, "Water God", "💎", "A hundred days at three litres."),
        (365, "The Tide", "🌊", "Three hundred and sixty-five days at three litres."),
    ]),
    ("no_phone_morning", "discipline", [
        (10, "Early Riser", "🌅", "Ten mornings without the phone."),
        (30, "Morning Monk", "🌄", "Thirty phone-free mornings."),
        (60, "Digital Ascetic", "📵", "Sixty phone-free mornings."),
        (180, "Quiet Mornings", "🌤️", "A hundred and eighty phone-free mornings."),
    ]),
    ("no_phone_evening", "discipline", [
        (10, "Night Owl", "🌙", "Ten nights without the phone before sleep."),
        (30, "Night Guardian", "🌙", "Thirty phone-free evenings."),
        (60, "Sunset Sage", "🌅", "Sixty phone-free evenings."),
        (180, "Quiet Nights", "🌌", "A hundred and eighty phone-free evenings."),
    ]),
    ("proofs", "checkin", [
        (5, "Show Don't Tell", "📸", "Five proof photos."),
        (25, "Receipts Only", "🧾", "Twenty-five proof photos."),
        (50, "Proof Machine", "📹", "Fifty proof photos."),
        (100, "On Record", "🗂️", "A hundred proof photos."),
    ]),
    ("perfect_day", "checkin", [
        (1, "Flawless", "💎", "Every line of the day landed."),
        (7, "Perfect Week", "🌟", "Seven perfect days."),
        (30, "Perfectionist", "👑", "Thirty perfect days."),
        (100, "Immaculate", "💠", "A hundred perfect days."),
        (365, "Flawless Year", "🏵️", "Three hundred and sixty-five perfect days."),
    ]),
    # The XP v3 quality tracks — what the day scored, not what was ticked.
    ("verified_days", "checkin", [
        (1, "Witnessed", "🔏", "Apple Health scored a day of yours."),
        (10, "Signal", "📡", "Ten days scored by Apple Health."),
        (30, "Steady Signal", "🛰️", "Thirty verified days."),
        (100, "Proven", "📈", "A hundred verified days."),
        (365, "Verified Year", "🧿", "Three hundred and sixty-five verified days."),
    ]),
    ("full_days", "checkin", [
        (1, "Full Day", "🟡", "A day that scored a hundred or more."),
        (10, "Ten Full", "🔆", "Ten full days."),
        (30, "Full Month", "🌕", "Thirty full days."),
        (100, "Hundred Full", "☀️", "A hundred full days."),
        (365, "Full Year", "🌞", "Three hundred and sixty-five full days."),
    ]),
    ("max_effort_days", "sport", [
        (1, "All Out", "🫀", "A training line at 50 of 50."),
        (10, "Ten All Out", "💥", "Ten max-effort days."),
        (50, "Fifty All Out", "🔥", "Fifty max-effort days."),
        (100, "Engine", "🏎️", "A hundred max-effort days."),
        (250, "Relentless", "⚡", "Two hundred and fifty max-effort days."),
    ]),
    ("full_sleep_nights", "discipline", [
        (10, "Ten Nights", "😴", "Ten nights of seven to nine hours on the record."),
        (30, "Well Slept", "🛌", "Thirty full nights."),
        (100, "Hundred Nights", "🌙", "A hundred full nights."),
        (365, "Year of Nights", "🌠", "Three hundred and sixty-five full nights."),
    ]),
    ("step_days", "sport", [
        (10, "Ten Thousand, Ten Times", "👟", "Ten days over ten thousand steps."),
        (30, "Walker", "🚶", "Thirty days over ten thousand steps."),
        (100, "Long Walker", "🥾", "A hundred days over ten thousand steps."),
        (365, "A Year on Foot", "🗺️", "Three hundred and sixty-five days over ten thousand steps."),
    ]),
    ("vault_practices", "vault", [
        (1, "Integrator", "🪞", "Ran a full Vault loop: idea, reflection, practice, integration."),
        (10, "Wayfinder", "🧭", "Ten Vault practices run and integrated."),
        (25, "Mastery Builder", "🗝️", "Twenty-five Vault practices run. The library is a workshop now."),
        (50, "Deep Shelf", "📚", "Fifty Vault practices."),
        (87, "Whole Vault", "🔐", "Every piece in the Vault, practised."),
    ]),
    ("battles_won", "battles", [
        (1, "First Blood", "⚔️", "Your first battle won."),
        (3, "Battle Hardened", "🛡️", "Three battles won."),
        (5, "Gladiator", "🏟️", "Five battles won."),
        (10, "Undefeated", "👑", "Ten battles won."),
        (15, "Champion Fighter", "🥊", "Fifteen battles won."),
        (25, "Warlord", "🔱", "Twenty-five battles won."),
        (50, "Battle God", "⚡", "Fifty battles won."),
    ]),
    ("tribe_battles_won", "tribe", [
        (1, "First Tribe Blood", "⚔️", "Your tribe's first battle won."),
        (5, "War Chief", "🛡️", "Five tribe battles won."),
        (15, "Tribe Conqueror", "🏆", "Fifteen tribe battles won."),
    ]),
    ("tribe_collective_streak", "tribe", [
        (7, "Spark Brother", "🔥", "Your whole tribe kept the fire seven days straight."),
        (30, "Tribe Ember", "🪵", "The whole tribe, thirty days without a gap."),
        (90, "Tribe Inferno", "🌋", "The whole tribe, ninety days."),
        (180, "Eternal Pyre", "☄️", "The whole tribe, a hundred and eighty days."),
    ]),
    ("paid_referrals", "social", [
        (1, "First Recruit", "🎯", "A friend you invited went paid."),
        (5, "Brand Ambassador", "🌟", "Five paying friends."),
        (10, "Inner Circle Founder", "👑", "Ten paying friends."),
        (25, "Kingmaker", "🏆", "Twenty-five paying friends."),
        (50, "Founders Circle", "🔱", "Fifty paying friends."),
    ]),
    ("referrals", "social", [
        (1, "Recruiter", "📣", "A friend joined with your code."),
        (5, "Squad Leader", "🫂", "Five friends joined with your code."),
        (15, "Army Builder", "🪖", "Fifteen friends joined with your code."),
    ]),
]

# Single badges: (key, value, category, rarity, name, icon, description, hidden)
SINGLES = [
    ("leaderboard_percentile", 10, "leaderboard", "rare", "Top 10%", "📊", "The top ten percent by rating.", False),
    ("leaderboard_percentile", 5, "leaderboard", "epic", "Top 5%", "🏅", "The top five percent by rating.", False),
    ("leaderboard_percentile", 1, "leaderboard", "legendary", "Top 1%", "💎", "The top one percent by rating.", False),
    ("season_champion", 1, "leaderboard", "legendary", "Season Champion", "🏆", "Finished first in a season.", False),
    ("single_post_likes", 20, "social", "epic", "Viral", "🔥", "Twenty likes on one post.", False),
    ("total_comments", 50, "social", "rare", "Commentator", "💬", "Fifty comments written.", False),
    ("total_kudos", 10, "social", "legendary", "Kudos Master", "🏆", "Ten kudos received for proof worth studying.", False),
    ("total_likes", 50, "social", "epic", "Influencer", "👑", "Fifty likes across your posts.", False),
    ("elite_member", 1, "status", "epic", "One of the Winners", "🏆", "Premium member. You went all in.", False),
    ("apex_founding", 1, "tier", "legendary", "Founding Apex", "✨", "Joined Apex on day one, paid.", False),
    ("apex_held_days", 14, "tier", "epic", "Apex Stronghold", "🏔️", "Held Apex for fourteen days.", False),
    ("apex_reached", 1, "tier", "epic", "Apex Reached", "💎", "Reached the Apex tier.", False),
    ("legend_held_days", 30, "tier", "legendary", "Eternal Legend", "👁️", "Held Legend for thirty days.", False),
    ("legend_reached", 1, "tier", "legendary", "Legend Ascendant", "🌟", "Reached the Legend tier.", False),
    ("tribe_founder_streak", 30, "tribe", "epic", "Tribe Founder", "👑", "A tribe you founded kept the fire thirty days.", False),
    ("vault_master:clear,aristotle,goggins", 3, "vault", "rare", "Discipline Builder", "⚒️", "Practised Clear, Aristotle and Goggins: systems, habituation, discomfort.", False),
    ("vault_master:epictetus,marcus-aurelius,seneca", 3, "vault", "rare", "Stoic Path", "🏛️", "Three Stoic practices run: Epictetus, Marcus Aurelius and Seneca.", False),
    ("vault_master:frankl,campbell", 2, "vault", "rare", "Meaning Seeker", "🔦", "Practised Frankl and Campbell: meaning, and the call to change.", False),
    ("vault_master:jung", 2, "vault", "rare", "Shadow Explorer", "🌑", "Worked Jung's lens twice: the shadow and what it projects.", False),
    # Secret: found, not followed. Shown as ? until earned.
    ("phoenix_recovery", 1, "streak", "rare", "Phoenix", "🦅", "Lost a thirty-day streak and built another.", True),
    ("comeback", 1, "streak", "rare", "Comeback", "🚪", "Back after thirty days away. The door was open.", True),
    ("both_ends_days", 30, "discipline", "epic", "Both Ends", "🌗", "Morning and evening meditation on the same day, thirty times.", True),
    ("long_haul", 1, "sport", "epic", "Long Haul", "🛤️", "A recorded workout of two hours or more.", True),
]

# Manual grants: no requirement, kept as they are.
MANUAL = [
    ("special", "legendary", "Founder", "⭐", "Early adopter of Whealth Factory."),
    ("seasonal", "rare", "Spring 26", "🌸", "Active during spring 2026."),
]

RENAMES = {
    "10 Check-ins": "Ten Days", "50 Check-ins": "Fifty", "100 Check-ins": "Century", "500 Check-ins": "Five Hundred",
    "30-Day Streak": "Thirty", "60-Day Dynasty": "Dynasty", "90-Day Streak": "Ninety", "100-Day Legend": "Hundred",
    "Level 5": "Journeyman", "Level 15": "Veteran", "Level 30": "Master",
    "Night Owl Discipline": "Night Owl",
}
# No holders; a duplicate rung (200 next to 250) and a duplicate key (personal_streak 100 = Hundred).
RETIRE = ["200 Workouts", "Inferno Personal"]


def rarity_for(index: int, count: int) -> str:
    from_end = count - 1 - index
    if from_end == 0 and count >= 4: return "legendary"
    if from_end <= 2 and count >= 4: return "epic"
    if index <= 1: return "common"
    return "rare"


def q(v):
    if v is None: return "NULL"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, int): return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    rows = []
    names = set()
    for key, category, rungs in LADDERS:
        rungs = sorted(rungs)
        for i, (value, name, icon, desc) in enumerate(rungs):
            rows.append((name, desc, icon, rarity_for(i, len(rungs)), category, key, value, False))
    for key, value, category, rarity, name, icon, desc, hidden in SINGLES:
        rows.append((name, desc, icon, rarity, category, key, value, hidden))
    for category, rarity, name, icon, desc in MANUAL:
        rows.append((name, desc, icon, rarity, category, None, None, False))
    for r in rows:
        assert r[0] not in names, f"duplicate name {r[0]}"
        names.add(r[0])
    for old, new in RENAMES.items():
        assert new in names, f"rename target {new} is not in the catalogue"
    for old in RETIRE:
        assert old not in names

    out = []
    out.append("-- Generated by scripts/badge-catalog.py — edit the script, not this file.")
    out.append(f"-- {len(rows)} badges.")
    out.append("")
    out.append("-- Renames first: a badge is its row, and members keep what they earned.")
    for old, new in RENAMES.items():
        out.append(f"UPDATE public.badges SET name = {q(new)} WHERE name = {q(old)};")
    out.append("")
    out.append("-- Retired (no holders): explicit, never NOT IN.")
    out.append(f"DELETE FROM public.badges WHERE name IN ({', '.join(q(n) for n in RETIRE)});")
    out.append("")
    out.append("INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value, hidden) VALUES")
    vals = []
    for name, desc, icon, rarity, category, key, value, hidden in rows:
        vals.append(f"  ({q(name)}, {q(desc)}, {q(icon)}, {q(rarity)}, {q(category)}, {q(key)}, {q(value)}, {q(hidden)})")
    out.append(",\n".join(vals))
    out.append("ON CONFLICT (name) DO UPDATE SET")
    out.append("  description = EXCLUDED.description, icon = EXCLUDED.icon, rarity = EXCLUDED.rarity,")
    out.append("  category = EXCLUDED.category, requirement_type = EXCLUDED.requirement_type,")
    out.append("  requirement_value = EXCLUDED.requirement_value, hidden = EXCLUDED.hidden;")
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
