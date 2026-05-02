-- This migration only modifies content rows in vault_articles (a public-readable
-- premium content table). No schema change.

BEGIN;

-- ============== RECIPES ==============
UPDATE public.vault_articles SET
  lesson_number = 2, course_role = 'protocol',
  why_it_matters = 'Protein is the single most leverage-rich macro for performance, recovery and longevity. Most people under-eat it — and the gap between 0.8 g/kg (the old RDA) and 1.6 g/kg (the evidence-based floor for active people) is the difference between losing muscle and building it.',
  try_today = ARRAY[
    'Weigh yourself this morning, then multiply by 1.6 — that is your daily protein floor in grams.',
    'Anchor 3 protein-led meals: 30–50 g at breakfast, lunch and dinner.',
    'If you train hard, add a 20–40 g shake or yogurt within 2 hours post-workout.'
  ],
  key_takeaways = ARRAY[
    'Active adults need 1.6–2.2 g/kg/day — not the outdated 0.8 g RDA.',
    'Distribution matters: 3–5 doses of 0.4 g/kg beats one large hit.',
    'Older adults need MORE protein, not less, to fight sarcopenia.'
  ],
  quiz = '[{"q":"What is the evidence-based daily protein floor for an active 80 kg adult?","choices":["64 g","128 g","240 g"],"correct":1,"explain":"80 kg × 1.6 g/kg = 128 g. The old 0.8 g RDA (64 g) is a minimum to avoid deficiency, not optimize performance."},{"q":"Why split protein across the day instead of one big meal?","choices":["It tastes better","Muscle protein synthesis maxes out around 0.4 g/kg per dose","It saves money"],"correct":1,"explain":"Each meal triggers a separate MPS response. 3–5 evenly spaced doses outperform the same total in 1–2 meals."}]'::jsonb
WHERE category_id = 'recipes' AND slug = 'protein-1-6-2-2-g-kg';

UPDATE public.vault_articles SET
  lesson_number = 3, course_role = 'protocol',
  why_it_matters = 'How you fuel a workout decides how much you can do, how you recover, and whether you adapt. Get this stack right and the same training session yields more — wrong, and you leave gains (and energy) on the table.',
  try_today = ARRAY[
    'Eat 0.5–1 g/kg carbs + 20–30 g protein 1–2 h before training.',
    'For sessions over 75 min, sip 30–60 g/h carbs (sports drink, gels, dates).',
    'Within 2 h post: 20–40 g protein + 1 g/kg carbs to refill glycogen.'
  ],
  key_takeaways = ARRAY[
    'Pre-workout fuel sets the ceiling for what you can do in the session.',
    'Intra-workout carbs only matter past ~75 min of hard work.',
    'The post-workout "anabolic window" is wide (~2 h), not 30 min.'
  ],
  quiz = '[{"q":"For a 60-minute strength session, intra-workout carbs are…","choices":["Essential","Optional — only critical past ~75 min","Banned"],"correct":1,"explain":"Glycogen handles 60–75 min easily. Intra-workout carbs become meaningful for longer or back-to-back sessions."},{"q":"How wide is the post-workout protein window?","choices":["30 minutes — strict","Roughly 2 hours","24 hours"],"correct":1,"explain":"Recent research (Schoenfeld, Aragon) shows the window is ~2 h, not the 30-min myth. Total daily protein matters more than precise timing."}]'::jsonb
WHERE category_id = 'recipes' AND slug = 'workout-fueling-stack';

UPDATE public.vault_articles SET
  lesson_number = 4, course_role = 'protocol',
  why_it_matters = 'No single food extends life. But one eating PATTERN — Mediterranean — has more high-quality outcome data behind it than any other: lower cardiovascular events, lower diabetes, lower cognitive decline. It is a default operating system for healthy eating.',
  try_today = ARRAY[
    'Make olive oil your primary cooking fat this week.',
    'Add 1 serving of fish (especially fatty: salmon, sardines) twice in the next 7 days.',
    'Build every dinner plate around vegetables + a protein + a whole grain or legume.'
  ],
  key_takeaways = ARRAY[
    'It is a PATTERN, not a recipe — vegetables, legumes, fish, olive oil, whole grains.',
    'PREDIMED trial: 30% reduction in major cardiovascular events vs. low-fat control.',
    'Compatible with most goals — body composition, longevity, metabolic health.'
  ],
  quiz = '[{"q":"What is the cornerstone fat of a Mediterranean pattern?","choices":["Butter","Extra virgin olive oil","Coconut oil"],"correct":1,"explain":"Olive oil — especially extra virgin — provides monounsaturated fats and polyphenols. PREDIMED used ~4 tbsp/day."},{"q":"Mediterranean eating is best described as…","choices":["A strict 1500-cal diet","A flexible food pattern, not a calorie protocol","A keto variant"],"correct":1,"explain":"It defines food choices and proportions, not calorie targets. That is why it adapts to nearly any goal."}]'::jsonb
WHERE category_id = 'recipes' AND slug = 'mediterranean-pattern';

UPDATE public.vault_articles SET
  lesson_number = 5, course_role = 'protocol',
  why_it_matters = 'Caffeine is the most-studied legal performance enhancer on Earth. Used right (dose + timing), it sharpens focus and adds 2–7 % to endurance and strength output. Used wrong, it wrecks the sleep that drives every other adaptation.',
  try_today = ARRAY[
    'Calculate your dose: 3 mg/kg body weight, 45–60 min before training.',
    'Set a hard caffeine cut-off 8–10 hours before bedtime.',
    'For 1 week, delay your first coffee until 90 min after waking and notice the energy curve.'
  ],
  key_takeaways = ARRAY[
    'Performance dose: 3–6 mg/kg, peaking ~45–60 min after intake.',
    'Half-life is ~5 h — caffeine at 2 PM is still 25 % active at midnight.',
    'Timing matters more than dose for sleep quality.'
  ],
  quiz = '[{"q":"A 70 kg athlete''s evidence-based pre-workout caffeine dose is roughly…","choices":["50 mg","210–420 mg","1000 mg"],"correct":1,"explain":"3–6 mg/kg × 70 kg = 210–420 mg. That is roughly 2–4 espresso shots."},{"q":"If your bedtime is 11 PM, when is the latest you should drink coffee?","choices":["8 PM","Around 1–3 PM","No limit"],"correct":1,"explain":"With a ~5 h half-life, coffee at 1–3 PM still leaves significant caffeine on board at bedtime — and that fragments sleep architecture."}]'::jsonb
WHERE category_id = 'recipes' AND slug = 'caffeine-timing';

-- ============== TRAINING ==============
UPDATE public.vault_articles SET
  lesson_number = 2, course_role = 'protocol',
  why_it_matters = 'Every adaptation — strength, hypertrophy, endurance — depends on one principle: your body must be asked to do slightly more than last time. Without progressive overload, you maintain. With it, you build for decades.',
  try_today = ARRAY['Open your training log. Find one main lift you''ll do this week.','Pick ONE variable to push: +1 rep, +2.5 kg, +1 set, or 5 s slower eccentric.','Write the target before you start the session — do not improvise.'],
  key_takeaways = ARRAY['Overload = "slightly more than last time" — not max effort every session.','You can progress on load, reps, sets, tempo, or range of motion.','No log = no overload. Tracking is non-negotiable.'],
  quiz = '[{"q":"Which is NOT a valid form of progressive overload?","choices":["Adding 1 rep at the same weight","Slowing the eccentric phase","Training to failure every set, every session"],"correct":2,"explain":"Failure every set leads to junk volume and recovery debt. Overload is methodical — small, trackable increments."},{"q":"What is the single most important habit for sustained progression?","choices":["A new program every 4 weeks","Tracking your sessions","Pre-workout supplements"],"correct":1,"explain":"You can''t progressively overload what you don''t measure. A simple notebook beats the fanciest program with no log."}]'::jsonb
WHERE category_id = 'training' AND slug = 'progressive-overload';

UPDATE public.vault_articles SET
  lesson_number = 3, course_role = 'protocol',
  why_it_matters = 'Zone 2 — the boring conversational pace — is the foundation Attia and Seiler call the "longevity engine". It builds mitochondrial density, fat oxidation, and the aerobic base that makes everything else (intervals, strength recovery, brain health) possible.',
  try_today = ARRAY['Pick one 45-min cardio session this week: bike, walk, jog, row.','Hold a pace where you can speak full sentences but not sing.','Aim for ~180 min/week split across 3–4 sessions.'],
  key_takeaways = ARRAY['The talk test: full sentences, no singing.','Target ~180 min/week across 3–4 sessions.','Boring is the point — the magic is mitochondrial, not muscular.'],
  quiz = '[{"q":"You''re in Zone 2 if…","choices":["You''re sweating heavily and gasping","You can hold a full conversation but not sing","You feel nothing at all"],"correct":1,"explain":"The talk test is the simplest and most reliable Zone 2 marker without a lab test."},{"q":"What is the weekly target for general health and longevity?","choices":["30 min","~180 min","10 hours"],"correct":1,"explain":"Roughly 180 min/week is the dose backed by Attia, Seiler, and ACSM guidelines for aerobic base building."}]'::jsonb
WHERE category_id = 'training' AND slug = 'zone-2-cardio';

UPDATE public.vault_articles SET
  lesson_number = 4, course_role = 'protocol',
  why_it_matters = 'VO₂max is the single best predictor of all-cause mortality. The Norwegian 4×4 protocol is the most time-efficient way to raise it — 28 minutes total, twice a week, with hard evidence behind it.',
  try_today = ARRAY['Schedule one 4×4 session this week (cycle, run, row, or hike a steep hill).','Warm up 10 min, then: 4 min hard (RPE 9/10), 3 min easy — repeat 4 times. Cool down 5 min.','Do not exceed 2× per week — this is a hard stimulus.'],
  key_takeaways = ARRAY['Structure: 4 min @ 90–95% HRmax, 3 min easy, ×4 rounds.','1–2× per week is enough — more is not better.','Pair with Zone 2: aerobic base + VO₂max ceiling = optimal cardio mix.'],
  quiz = '[{"q":"What is the work:rest ratio of the Norwegian 4×4?","choices":["1:1","4 min hard : 3 min easy","30 sec : 4 min"],"correct":1,"explain":"4 minutes at 90–95% max effort, 3 minutes active recovery, repeated four times. Total ~28 min including warm-up and cool-down."},{"q":"Why limit 4×4 sessions to 1–2× per week?","choices":["Equipment cost","Recovery cost — it is near-maximal effort","It''s ineffective more often"],"correct":1,"explain":"Each session is near-VO₂max. More frequent sessions accumulate fatigue faster than they build adaptation."}]'::jsonb
WHERE category_id = 'training' AND slug = 'vo2max-4x4';

UPDATE public.vault_articles SET
  lesson_number = 5, course_role = 'protocol',
  why_it_matters = 'Adaptation happens during recovery, not during work. Skipping deload weeks is the #1 way trained lifters stall, accumulate joint pain, and burn out. A planned deload every 4–6 weeks PROTECTS your gains.',
  try_today = ARRAY['Open your calendar. Mark "DELOAD" 4 weeks from today.','Plan that week: same exercises, ~60% of normal volume, ~80% of normal intensity.','Resist the urge to "just push through" — the deload IS the work.'],
  key_takeaways = ARRAY['Deload = planned recovery, not skipped training.','Frequency: every 4–6 weeks for trained lifters.','Cut volume to ~60%, keep intensity at ~80% to maintain neural patterns.'],
  quiz = '[{"q":"What does a deload week look like in practice?","choices":["No training at all","Same exercises, ~60% volume and ~80% intensity","Random new movements"],"correct":1,"explain":"Maintain movement patterns and skill, but slash total work. Total rest can detrain you; smart deload restores you."},{"q":"How often should a trained lifter deload?","choices":["Never","Every 4–6 weeks","Every 6 months"],"correct":1,"explain":"4–6 weeks of progressive overload typically accumulates enough fatigue that a deload boosts the next training block."}]'::jsonb
WHERE category_id = 'training' AND slug = 'deload-periodization';

-- ============== RECOVERY ==============
UPDATE public.vault_articles SET
  lesson_number = 2, course_role = 'protocol',
  why_it_matters = 'No supplement, no protocol, no training plan compensates for chronic sleep loss. Sleep is when memory consolidates, hormones reset, glucose normalises, and the brain literally washes itself. 7–9 hours is not a luxury — it is the baseline dose.',
  try_today = ARRAY['Pick a fixed wake time and reverse-engineer your bedtime: wake − 8 h − 30 min wind-down.','Set a "phone goes in the kitchen" alarm 60 min before bed tonight.','Track sleep duration for 7 days — most people underestimate by 30–60 min.'],
  key_takeaways = ARRAY['The dose is 7–9 hours — for 95% of adults, you are not the exception.','Consistent timing matters as much as duration.','Sleep debt cannot be fully repaid on weekends.'],
  quiz = '[{"q":"What % of adults are genetic short sleepers who truly need <7 h?","choices":["About 30%","Less than 1%","About 50%"],"correct":1,"explain":"True short sleepers (DEC2 mutation carriers) are <1% of the population. Almost everyone who claims to need 5 h is sleep-deprived."},{"q":"Sleeping in on weekends fully repays a week of 6-hour nights. True or false?","choices":["True","False — chronic loss leaves residual cognitive and metabolic deficits","Only with naps"],"correct":1,"explain":"Walker''s research shows weekend recovery is partial at best. Consistent nightly dose beats compensation."}]'::jsonb
WHERE category_id = 'recovery' AND slug = 'sleep-7-9-hours';

UPDATE public.vault_articles SET
  lesson_number = 3, course_role = 'protocol',
  why_it_matters = 'Your circadian clock is set by light, not by the calendar. Morning sunlight in your eyes within an hour of waking is the strongest, cheapest, most reliable circadian anchor — better mood, better energy, better sleep that same night.',
  try_today = ARRAY['Tomorrow morning: step outside (no sunglasses) within 60 min of waking.','Aim for 5–10 min on a bright day, 15–20 min on overcast days.','Pair it with a habit you already have — coffee, dog walk, commute.'],
  key_takeaways = ARRAY['Outdoor light is 10–100× brighter than indoor — windows don''t count.','Dose: 5–10 min sunny, 15–20 min overcast, 30+ min on dark days.','No sunglasses (clear glasses fine) — the eyes need the photons.'],
  quiz = '[{"q":"Why doesn''t getting bright indoor light count as morning circadian anchoring?","choices":["It does count","Indoor light is 10–100× dimmer than outdoor — usually below threshold","Walls block UV"],"correct":1,"explain":"A bright office is ~500 lux. Outdoor cloudy: 10,000 lux. Outdoor sunny: 50,000+ lux. The dose difference is huge."},{"q":"How long should you aim for on a sunny morning?","choices":["1 minute","5–10 minutes","2 hours"],"correct":1,"explain":"5–10 min is typically enough on a sunny day for the SCN (circadian master clock) to register a strong signal."}]'::jsonb
WHERE category_id = 'recovery' AND slug = 'morning-light-anchor';

UPDATE public.vault_articles SET
  lesson_number = 4, course_role = 'protocol',
  why_it_matters = 'Even when caffeine "doesn''t affect your sleep", it does. Caffeine blocks adenosine receptors well into the night, suppressing deep sleep — the architecture, not just the duration, suffers. The single biggest sleep upgrade for most people is the cut-off time.',
  try_today = ARRAY['Identify your latest caffeine source today — coffee, tea, soda, dark chocolate, gum.','Calculate cut-off: bedtime − 8 to 10 hours. For an 11 PM bedtime that is 1–3 PM.','Replace your afternoon coffee with decaf or herbal for 7 days, then assess.'],
  key_takeaways = ARRAY['Half-life ~5 h means 25% of your caffeine is still active 10 h later.','Cut-off: bedtime − 8 to 10 hours.','Even if you sleep, late caffeine suppresses deep (slow-wave) sleep.'],
  quiz = '[{"q":"You feel like late coffee doesn''t affect your sleep. Most likely…","choices":["You''re right","Subjective sleep feels fine but deep sleep is measurably suppressed","Caffeine doesn''t cross the blood-brain barrier"],"correct":1,"explain":"Studies (Drake et al. 2013) show late caffeine cuts ~30 min of deep sleep even when total sleep time is unchanged. You don''t notice — your brain does."},{"q":"For an 11 PM bedtime, the ideal latest caffeine time is around…","choices":["8 PM","1–3 PM","Any time"],"correct":1,"explain":"With a ~5 h half-life, 1–3 PM gives caffeine time to clear before bedtime."}]'::jsonb
WHERE category_id = 'recovery' AND slug = 'caffeine-cutoff';

UPDATE public.vault_articles SET
  lesson_number = 5, course_role = 'protocol',
  why_it_matters = 'Cold exposure is the most over-hyped tool in modern wellness — but used correctly, it boosts mood, dopamine, and resilience. Used incorrectly (right after lifting), it actively blunts hypertrophy gains. Timing decides whether it helps or hurts.',
  try_today = ARRAY['If trying cold for the first time: 1–3 min at the end of a normal shower at the coldest setting.','NEVER cold-plunge within 4–6 hours after a strength session you care about.','Pre-meeting / pre-focus block: 2 min cold for a 250% dopamine bump (Šrámek et al. 2000).'],
  key_takeaways = ARRAY['Effective dose: 11 min/week total, ≤15 °C, in 2–3 min sessions.','AVOID cold within 4–6 h post-strength training — it blunts hypertrophy.','Best uses: morning alertness, mood, mental resilience.'],
  quiz = '[{"q":"When is the WORST time to take a cold plunge?","choices":["Morning","Within 4–6 h after a hypertrophy strength session","Before bed"],"correct":1,"explain":"Cold immediately post-lifting blunts the inflammatory cascade that drives muscle growth (Roberts et al. 2015)."},{"q":"Total weekly dose for the documented mood/resilience benefits is roughly…","choices":["1 hour daily","~11 minutes total per week","30 minutes per session"],"correct":1,"explain":"Søberg et al. and others converge on ~11 min/week as the threshold dose. More is not better."}]'::jsonb
WHERE category_id = 'recovery' AND slug = 'cold-exposure';

-- ============== MIND ==============
UPDATE public.vault_articles SET
  lesson_number = 2, course_role = 'protocol',
  why_it_matters = 'In an acute stress spike — before a hard call, mid-conflict, in traffic — you cannot think your way out. You CAN breathe your way out. Box breathing is the Navy SEAL go-to for a reason: it forces the parasympathetic system online in 60–90 seconds.',
  try_today = ARRAY['Pick one stressful moment today (meeting, commute, hard conversation).','Run 4 rounds: inhale 4, hold 4, exhale 4, hold 4. Total = 64 seconds.','Notice the difference in your body before vs. after.'],
  key_takeaways = ARRAY['Pattern: 4-4-4-4 (inhale, hold, exhale, hold).','Acute use: 4–8 rounds for fast down-regulation.','Works because of vagal tone activation — physiology, not belief.'],
  quiz = '[{"q":"What is the box breathing pattern?","choices":["6-2-6-2","4-4-4-4","8-0-8-0"],"correct":1,"explain":"Equal-length inhale, hold, exhale, hold. The symmetry is the point — it engages voluntary parasympathetic control."},{"q":"When is box breathing MOST useful?","choices":["Long-term meditation","Acute stress, before a high-pressure moment","Falling asleep"],"correct":1,"explain":"For sleep, the physiological sigh or 4-7-8 work better. Box breathing is the acute-stress tool."}]'::jsonb
WHERE category_id = 'mind' AND slug = 'box-breathing';

UPDATE public.vault_articles SET
  lesson_number = 3, course_role = 'protocol',
  why_it_matters = 'The fastest known biological tool for calming your nervous system: a double inhale through the nose, then a long exhale through the mouth. It works in seconds. Stanford research (Huberman / Spiegel 2023) confirmed it outperforms other breath techniques and even meditation for acute mood improvement.',
  try_today = ARRAY['Right now: inhale through your nose, then take a second small inhale to fully fill your lungs.','Exhale slowly and completely through your mouth.','Repeat 1–3 times. Use it any time stress spikes.'],
  key_takeaways = ARRAY['Pattern: double nasal inhale, long mouth exhale.','Works in seconds — uses the body''s natural sigh reflex.','Out-performed cyclic breathing AND meditation in the Stanford trial.'],
  quiz = '[{"q":"How is the physiological sigh performed?","choices":["One slow inhale, hold","Double inhale through nose, long exhale through mouth","Mouth inhale, nose exhale"],"correct":1,"explain":"The double inhale re-inflates collapsed alveoli; the long exhale offloads CO₂ and triggers vagal slow-down."},{"q":"In the Stanford 2023 trial, the physiological sigh outperformed…","choices":["Nothing","Cyclic hyperventilation, box breathing AND meditation for acute mood","Only placebo"],"correct":1,"explain":"5 min/day of physiological sighs produced larger acute mood and arousal improvements than the other arms."}]'::jsonb
WHERE category_id = 'mind' AND slug = 'physiological-sigh';

UPDATE public.vault_articles SET
  lesson_number = 4, course_role = 'protocol',
  why_it_matters = 'Mindfulness is not mystical. It is attention training, and 30+ years of MBSR (Mindfulness-Based Stress Reduction) research show the dose-response is real: 10 minutes a day produces measurable changes in stress reactivity, sleep, and pain perception within 8 weeks.',
  try_today = ARRAY['Sit comfortably for 10 minutes today.','Focus on the sensation of breathing — when your mind wanders, notice it and return.','That return is the rep. The wandering is not failure.'],
  key_takeaways = ARRAY['Dose: 10 min/day produces measurable changes in 8 weeks.','The "rep" is noticing distraction and returning — not staying focused.','Use Waking Up, Headspace, Calm or Insight Timer — guidance helps a lot at the start.'],
  quiz = '[{"q":"What is the actual rep you''re training in mindfulness?","choices":["Staying perfectly focused","Noticing your mind has wandered and bringing attention back","Sitting still for the full time"],"correct":1,"explain":"Each return is a rep of attentional control. Wandering is not failure — it is the setup for the next rep."},{"q":"What is the standard MBSR dose that produces measurable change?","choices":["1 hour, weekly","~10 min/day for 8 weeks","No fixed dose"],"correct":1,"explain":"MBSR research consistently shows ~10 min/day over 8 weeks shifts stress reactivity, sleep markers and pain perception."}]'::jsonb
WHERE category_id = 'mind' AND slug = 'mindfulness-mbsr';

UPDATE public.vault_articles SET
  lesson_number = 5, course_role = 'protocol',
  why_it_matters = 'Most emotional suffering comes not from events but from the stories we tell about them. Cognitive reframing — the core skill of CBT — is the most evidence-based intervention in all of psychology. It is a learnable, repeatable mental skill, not a personality trait.',
  try_today = ARRAY['When something upsets you today, write down the situation in one sentence.','Write the automatic thought it triggered ("I''m a failure", "They hate me").','Ask: what is the evidence FOR and AGAINST this thought? Write a more balanced reframe.'],
  key_takeaways = ARRAY['Events don''t cause feelings — interpretations do.','Reframing is a skill: situation → thought → evidence → balanced view.','CBT is the most-validated psychological intervention in history.'],
  quiz = '[{"q":"In CBT, what comes between an event and your emotional reaction?","choices":["Nothing","An automatic thought / interpretation","Your hormones"],"correct":1,"explain":"The event triggers a thought, which triggers the emotion. Reframing intervenes at the thought layer — the only one you can directly edit."},{"q":"Which is a core reframing question?","choices":["Why do bad things happen to me?","What''s the evidence for and against this thought?","Who can I blame?"],"correct":1,"explain":"Examining evidence breaks the loop of automatic catastrophic thinking and produces more balanced, accurate appraisals."}]'::jsonb
WHERE category_id = 'mind' AND slug = 'cognitive-reframing';

-- ============== NERVOUS SYSTEM ==============
UPDATE public.vault_articles SET
  lesson_number = 2, course_role = 'protocol',
  why_it_matters = 'Your nervous system has three states — safe/social, fight-or-flight, and shutdown. Polyvagal theory (Stephen Porges) gives you a map for which state you are in and how to move between them. This map is the basis of every nervous-system tool that follows.',
  try_today = ARRAY['Right now, scan: am I in safe/social, fight-or-flight, or shutdown?','Note the body cues: warm + open vs. tight + alert vs. heavy + numb.','Use one tool today (sigh, cold face, humming) and re-scan after.'],
  key_takeaways = ARRAY['Three states: safe/social, fight-or-flight, shutdown.','The vagus nerve is the brake — high vagal tone = better regulation.','You move between states via cues: breath, face/voice, social contact, temperature.'],
  quiz = '[{"q":"How many primary autonomic states does polyvagal theory describe?","choices":["Two: stress and calm","Three: safe/social, fight-or-flight, shutdown","Five"],"correct":1,"explain":"The three-state model is what makes polyvagal practical — including shutdown explains exhaustion and emotional numbing the old two-state model missed."},{"q":"Vagal tone is the body''s…","choices":["Stress accelerator","Parasympathetic brake","Hormonal panel"],"correct":1,"explain":"The vagus nerve is the main parasympathetic highway — better tone = faster, smoother return to baseline after stress."}]'::jsonb
WHERE category_id = 'nervous-system' AND slug = 'polyvagal-fundamentals';

UPDATE public.vault_articles SET
  lesson_number = 3, course_role = 'protocol',
  why_it_matters = 'NSDR (Non-Sleep Deep Rest) is a 10–20 minute guided body-scan that mimics the brain-state of deep sleep. Research (Yoga Nidra studies + Huberman Lab) shows it boosts dopamine 65%, restores cognitive performance after sleep loss, and accelerates skill consolidation.',
  try_today = ARRAY['Find a 10-min NSDR on YouTube (search "NSDR Huberman 10 min").','Lie down somewhere quiet — phone in another room.','Best windows: post-lunch (2 PM dip) or after a hard training session.'],
  key_takeaways = ARRAY['Dose: 10–20 min, 1× per day if sleep-deprived, 2–3×/week otherwise.','Recovers 30–60 min of subjective sleep without going unconscious.','Best windows: post-lunch dip, after hard training, before evening focus blocks.'],
  quiz = '[{"q":"What did the seminal Yoga Nidra study (Kjaer et al. 2002) measure?","choices":["A 65% rise in endogenous dopamine","Increased cortisol","Lower body temperature only"],"correct":0,"explain":"Kjaer et al. measured a 65% increase in striatal dopamine release during NSDR — comparable to no other behavioural intervention."},{"q":"NSDR is BEST used when…","choices":["You''re already well-rested and energetic","You''re fatigued, sleep-deprived, or post-training","Right before bed"],"correct":1,"explain":"NSDR is a recovery tool — it shines when there is a recovery debt to repay, especially in the post-lunch dip or after hard training."}]'::jsonb
WHERE category_id = 'nervous-system' AND slug = 'nsdr-yoga-nidra';

UPDATE public.vault_articles SET
  lesson_number = 4, course_role = 'protocol',
  why_it_matters = 'Most adults breathe 12–18 times per minute. Slow that to ~5.5 breaths/minute and you hit your "resonance frequency" — heart rate, blood pressure and HRV synchronize. 5 min/day raises baseline HRV and stress resilience over weeks.',
  try_today = ARRAY['Set a 5-minute timer.','Breathe in for 5.5 seconds, out for 5.5 seconds (~5.5 bpm).','Use a paced-breathing app (Othership, Breathe+, or just count) for the rhythm.'],
  key_takeaways = ARRAY['Resonance frequency for most adults: ~5.5 breaths/min.','Dose: 5 min/day raises baseline HRV in 4–8 weeks.','Best done seated, eyes open or closed, twice daily for fastest gains.'],
  quiz = '[{"q":"What is the approximate resonance frequency breath rate for most adults?","choices":["12 bpm","~5.5 bpm","20 bpm"],"correct":1,"explain":"~5.5 bpm (≈11 sec per cycle) maximizes heart rate variability and engages the baroreflex most strongly."},{"q":"How long does it typically take to see baseline HRV gains from coherent breathing?","choices":["A single session","4–8 weeks at 5 min/day","Years"],"correct":1,"explain":"Lehrer et al. and Steffen et al. show measurable HRV baseline shifts in 4–8 weeks of consistent daily practice."}]'::jsonb
WHERE category_id = 'nervous-system' AND slug = 'coherent-breathing-5-5';

UPDATE public.vault_articles SET
  lesson_number = 5, course_role = 'protocol',
  why_it_matters = 'When your face hits cold water, the mammalian dive reflex activates — heart rate drops, vagal tone surges, and your nervous system slams the brake within 30–60 seconds. It is the fastest non-pharmacological way to abort an anxiety spiral.',
  try_today = ARRAY['Fill a bowl with cold water + a few ice cubes (target ~10–15 °C).','Hold your breath, dip your forehead, eyes and cheekbones for 15–30 seconds.','Repeat 2–3 times if needed. Save it for genuine stress / panic moments.'],
  key_takeaways = ARRAY['Activates the mammalian dive reflex — heart rate drops within seconds.','Best for acute panic, racing thoughts, sleeplessness from stress.','Cold WATER on face is more effective than just cold air or an ice pack.'],
  quiz = '[{"q":"Why does cold water on the face slow your heart rate so quickly?","choices":["It distracts you","It triggers the mammalian dive reflex via the trigeminal nerve","It releases adrenaline"],"correct":1,"explain":"Cold water on the trigeminal-innervated forehead/cheeks triggers a vagal cascade — bradycardia plus peripheral vasoconstriction in seconds."},{"q":"What is this technique BEST used for?","choices":["Daily meditation","Acute panic, anxiety spiral, or sleeplessness from stress","Building muscle"],"correct":1,"explain":"It is an acute-state break-glass tool — extremely fast onset for nervous-system override, not a daily wellness habit."}]'::jsonb
WHERE category_id = 'nervous-system' AND slug = 'cold-face-dive-reflex';

-- ====================================================================
-- Foundations lessons (one per category)
-- ====================================================================
INSERT INTO public.vault_articles (
  category_id, slug, title, subtitle, summary,
  evidence_tier, read_time_min,
  protocol, benefits, risks, body_md, references_json,
  display_order, lesson_number, course_role,
  why_it_matters, try_today, key_takeaways, quiz
) VALUES
(
  'recipes', 'foundations-performance-nutrition',
  'Foundations: How to think about food', 'Pattern over perfection',
  'Before any specific protocol, you need a mental model. Performance nutrition rests on four pillars: enough protein, smart carbs around training, a Mediterranean-style base, and caffeine used as a tool — not a crutch.',
  'strong', 4,
  '{"duration":"4 min read","intensity":"Conceptual","frequency":"Read once, return as needed","prerequisites":"None"}'::jsonb,
  ARRAY['A clear mental model for every food decision','Stops you from chasing fad diets','Sets you up to apply the next 4 lessons'],
  ARRAY['Not a substitute for medical or registered-dietitian advice for clinical conditions'],
  E'## The four pillars\n\nWe will not teach you a "diet". Diets are short-term identities; PATTERNS are long-term operating systems. Across the next four lessons, you will master four levers:\n\n1. **Protein dose** (how much, how often)\n2. **Workout fueling** (what to eat before, during, after training)\n3. **Mediterranean pattern** (the default base for the other 80% of your meals)\n4. **Caffeine** (the most-studied legal performance tool on Earth)\n\n## Why this order matters\n\nProtein first, because under-eating it is the single most common nutrition mistake in active adults. Workout fueling second, because training is your highest-leverage activity. Mediterranean third, because it is the chassis everything else sits on. Caffeine last, because it is the cherry on top — useful, but not foundational.\n\n## What we ignore\n\n- Specific calorie targets (depends on your goal — track weight + adjust)\n- Supplements beyond protein and caffeine (most have weaker evidence than diet basics)\n- Trendy frameworks (carnivore, fruitarian, IF as religion) — none beat the Mediterranean pattern in head-to-head outcome data\n\nRead this once. Then move to Lesson 2.',
  '[{"author":"Attia, P.","title":"Outlive: The Science and Art of Longevity","year":2023},{"author":"Phillips, S.","title":"Dietary protein for athletes — review","year":2014,"url":"https://pubmed.ncbi.nlm.nih.gov/25315456/"}]'::jsonb,
  1, 1, 'foundations',
  'You are about to learn 4 specific protocols. Without the mental model that ties them together, you will treat them as a checklist — and lose interest in 3 weeks. The four pillars are the spine.',
  ARRAY['Read this lesson, then commit to the next 4 in order over the next 7 days.'],
  ARRAY['Patterns beat diets — every time.','The order is intentional: protein → fueling → Mediterranean → caffeine.','You are training a system, not following a recipe.'],
  '[{"q":"What is the difference between a diet and a pattern?","choices":["No difference","A diet is short-term and identity-based; a pattern is a long-term operating system","Diets are healthier"],"correct":1,"explain":"Patterns survive holidays, vacations, busy weeks. Diets do not. The Mediterranean evidence is so strong precisely because it is a pattern."},{"q":"Which pillar is the FIRST priority for active adults?","choices":["Caffeine","Protein dose","Avoiding seed oils"],"correct":1,"explain":"Under-eating protein is the most common, highest-cost nutrition mistake in active adults — addressing it has the largest single impact."}]'::jsonb
),
(
  'training', 'foundations-strength-conditioning',
  'Foundations: How adaptation actually works', 'Stress · recover · adapt',
  'Every gain — strength, endurance, VO₂max — follows the same loop: apply a precise stress, recover from it, adapt. This lesson gives you the loop. The next four show you the levers.',
  'strong', 4,
  '{"duration":"4 min read","intensity":"Conceptual","frequency":"Read once, return as needed","prerequisites":"None"}'::jsonb,
  ARRAY['A unified mental model for every form of training','Stops you from program-hopping every 3 weeks','Explains WHY the next 4 protocols work'],
  ARRAY['Not a replacement for individual coaching if you have specific injuries or competitive goals'],
  E'## The adaptation loop\n\nAll training works through one cycle:\n\n1. **Stress** — you do something slightly harder than your body is used to.\n2. **Recovery** — you sleep, eat, and rest enough to repair.\n3. **Adaptation** — your body rebuilds slightly stronger / fitter / more capable.\n\nMiss any step and you get nothing. Most people fail at #2.\n\n## The four levers\n\nThis course covers the four highest-leverage levers across the strength + cardio spectrum:\n\n1. **Progressive overload** — the principle behind every strength gain in history.\n2. **Zone 2 cardio** — the boring base that builds your aerobic engine.\n3. **VO₂max intervals (4×4)** — the most time-efficient ceiling-raiser.\n4. **Deload weeks** — the planned recovery that protects everything else.\n\n## What we deliberately skip\n\n- Specific exercise selection (squat vs. leg press, etc.)\n- Splits (push/pull/legs vs. upper/lower) — they all work if overload is real\n- Trendy modalities (DUP, blood-flow restriction, instability training) — useful but not foundational\n\n## The single biggest mistake\n\nProgram-hopping. The body adapts to the program you actually FINISH, not the one you started. Pick a structure, hold it for 8–12 weeks with progressive overload, then deload, then evaluate.',
  '[{"author":"Schoenfeld, B.","title":"Science and Development of Muscle Hypertrophy","year":2020},{"author":"ACSM","title":"Guidelines for Exercise Testing and Prescription, 11th ed.","year":2021}]'::jsonb,
  1, 1, 'foundations',
  'Without the stress → recovery → adaptation loop, every protocol below looks like an arbitrary trick. With it, they all click into place as variations on the same theme.',
  ARRAY['Look at your last 3 months of training — did you actually FINISH a program, or hop?','Commit to ONE structure for the next 8 weeks.'],
  ARRAY['All training is: stress → recovery → adaptation.','Most failures are recovery failures, not effort failures.','Programs that get finished beat programs that get optimized.'],
  '[{"q":"Where does adaptation actually happen?","choices":["During the workout","During recovery","During warm-up"],"correct":1,"explain":"The session is the stimulus; the rebuild happens during sleep, food, and rest. Skip recovery, lose the adaptation."},{"q":"What is the single most common reason people do not see results?","choices":["Wrong exercises","Program-hopping before adaptation completes","Bad genetics"],"correct":1,"explain":"The body adapts to programs that get FINISHED. Most people abandon an effective program at week 5 because they are bored — and start over with no overload."}]'::jsonb
),
(
  'recovery', 'foundations-recovery-and-sleep',
  'Foundations: Sleep is the dose, light is the timer', 'Three levers, one outcome',
  'Recovery is not one thing — it is a stack. Sleep is the foundational dose. Morning light is the timer that anchors it. Caffeine cut-off and cold exposure are the two biggest variables you control around it.',
  'strong', 4,
  '{"duration":"4 min read","intensity":"Conceptual","frequency":"Read once, return as needed","prerequisites":"None"}'::jsonb,
  ARRAY['Reframes recovery as a system, not a list','Tells you which lever to pull first','Sets up the next 4 protocols in priority order'],
  ARRAY['If you suspect a clinical sleep disorder (apnea, severe insomnia), see a sleep specialist'],
  E'## The hierarchy\n\nThere is no point optimizing your cold plunge if you sleep 5 hours. Recovery has a clear hierarchy:\n\n1. **Sleep duration** (7–9 h) — the dose\n2. **Sleep timing & circadian anchoring** (morning light) — the timer\n3. **Sleep architecture protectors** (caffeine cut-off) — the variables you control\n4. **Stress / mood adjuncts** (cold exposure) — the cherry, NOT the foundation\n\nThe next 4 lessons walk down this list in order.\n\n## Why morning light is in here\n\nBecause your sleep that night is set 14–16 hours earlier — when light first hits your eyes in the morning. The single highest-leverage thing you can do for tonight''s sleep is what you do tomorrow morning at 7 AM.\n\n## What we deliberately skip\n\n- Sleep tracker rabbit holes (Oura, Whoop) — useful, not essential\n- Magnesium / melatonin / supplements — supportive at best, not foundational\n- Mattress / pillow optimization — once it is adequate, returns drop fast\n\n## The single biggest mistake\n\nTreating recovery as a list of "biohacks" rather than a hierarchy. Cold plunges and red lights are interesting; they are not what fixes a 6-hour sleep average.',
  '[{"author":"Walker, M.","title":"Why We Sleep","year":2017},{"author":"Huberman, A.","title":"Huberman Lab Podcast — Sleep series","year":2021}]'::jsonb,
  1, 1, 'foundations',
  'If you only have time for ONE recovery improvement, this lesson tells you which one. Most people start at the bottom of the hierarchy (cold plunge) instead of the top (sleep duration).',
  ARRAY['Audit your last 7 nights — what was your average sleep duration?','If it is under 7 hours, fix that BEFORE optimizing anything else in this course.'],
  ARRAY['Sleep is the dose. Light is the timer. Everything else is a variable.','Optimize top-down — 7–9 h sleep first, then morning light, then caffeine, then cold.','No biohack rescues a 6-hour average.'],
  '[{"q":"What is the TOP of the recovery hierarchy?","choices":["Cold plunge","Sleep duration (7–9 h)","Massage"],"correct":1,"explain":"Sleep duration dominates everything else. No other recovery tool compensates for chronic sleep restriction."},{"q":"When is the highest-leverage moment for tonight''s sleep?","choices":["10 PM tonight","Tomorrow morning, when light first hits your eyes","After dinner"],"correct":1,"explain":"Your circadian rhythm is set 14–16 hours before sleep, by morning light exposure. That is when the timer is set."}]'::jsonb
),
(
  'mind', 'foundations-mind-and-emotion',
  'Foundations: Emotion is a skill, not a personality', 'Acute · daily · structural',
  'You can train emotional regulation the same way you train a deadlift. The next four lessons give you tools at three time-scales: acute (seconds), daily (minutes), and structural (weeks-to-months).',
  'strong', 4,
  '{"duration":"4 min read","intensity":"Conceptual","frequency":"Read once, return as needed","prerequisites":"None"}'::jsonb,
  ARRAY['Reframes emotion as trainable, not fixed','Maps each tool to the right moment','Removes the "I am just an anxious person" trap'],
  ARRAY['Not a substitute for therapy in cases of clinical depression, PTSD, or anxiety disorders'],
  E'## Three time-scales\n\nEmotional skill operates at three different time-scales — and you need a tool for each:\n\n| Time-scale | Tool | Lesson |\n|---|---|---|\n| Acute (seconds) | Box breathing, physiological sigh | 2 & 3 |\n| Daily (10 min) | Mindfulness practice | 4 |\n| Structural (weeks) | Cognitive reframing (CBT) | 5 |\n\n## Why all three\n\nUsing only acute tools = you are constantly putting out fires. Using only daily practice = you have a calmer baseline but still get hijacked by acute spikes. Using only structural reframing = your thoughts are more accurate but your body still races. **You need all three.**\n\n## What we deliberately skip\n\n- Specific therapy modalities (ACT, IFS, EMDR) — work with a therapist for those\n- Long meditation retreats — useful but not foundational\n- Psychedelics — emerging evidence but outside the scope of an introductory course\n\n## The single biggest mistake\n\nWaiting until you feel bad to "try" any of this. These are skills. They get installed during easy moments so they are available during hard ones. Practice them when you don''t need them.',
  '[{"author":"Hofmann, S.","title":"The efficacy of cognitive behavioral therapy: a review of meta-analyses","year":2012},{"author":"Goyal, M.","title":"Meditation programs for psychological stress and well-being","year":2014}]'::jsonb,
  1, 1, 'foundations',
  'Before learning four specific tools, you need to know WHEN to deploy each. The three-time-scale framework tells you which tool fits which moment.',
  ARRAY['Identify ONE moment in your typical day when emotion most often hijacks you.','Pick which time-scale it lives at: acute spike, daily background, or structural pattern.'],
  ARRAY['Emotion is a skill — train it like any other.','You need tools at three time-scales, not one.','Practice during easy moments so the skills exist in hard ones.'],
  '[{"q":"Which tool is best for an ACUTE emotional spike (under 60 sec)?","choices":["Mindfulness","Cognitive reframing","Physiological sigh / box breathing"],"correct":2,"explain":"Acute spikes need acute tools — breath techniques work in seconds. Reframing and mindfulness need more time and a calmer baseline."},{"q":"Why do you need tools at multiple time-scales?","choices":["You do not","Each scale addresses different aspects — acute fires, daily baseline, structural patterns","Only acute tools work"],"correct":1,"explain":"Acute tools handle spikes; daily practice raises baseline calm; structural reframing changes the underlying thought patterns. They complement each other."}]'::jsonb
),
(
  'nervous-system', 'foundations-nervous-system',
  'Foundations: Mapping your autonomic states', 'Three states · two modes · one toolkit',
  'Your nervous system is not "stressed" or "calm" — it has three distinct states (Porges'' polyvagal model). Knowing which one you are in tells you which tool to use. Without this map, you are guessing.',
  'strong', 4,
  '{"duration":"4 min read","intensity":"Conceptual","frequency":"Read once, return as needed","prerequisites":"None"}'::jsonb,
  ARRAY['Gives you a vocabulary for what you are feeling','Maps every tool in this course to the right state','Cuts through "stress vs. calm" oversimplification'],
  ARRAY['Polyvagal theory has critics in academic neuroscience — treat it as a useful clinical model, not settled physics'],
  E'## The three states\n\nPorges'' polyvagal model describes three autonomic states, each with a clear bodily signature:\n\n| State | Body cue | When you are in it |\n|---|---|---|\n| **Safe / social** (ventral vagal) | Warm, open, easy breath | Relaxed conversation, flow |\n| **Fight / flight** (sympathetic) | Tight, alert, fast breath | Stress spike, urgency |\n| **Shutdown** (dorsal vagal) | Heavy, numb, dissociated | Burnout, overwhelm, depression |\n\nMost wellness advice acts as if there are only two states (stressed vs. calm). The shutdown state — heavy, exhausted, "checked out" — needs DIFFERENT tools than fight-or-flight.\n\n## The toolkit (next 4 lessons)\n\n| Tool | Best for |\n|---|---|\n| **NSDR / Yoga Nidra** | Recovery from depletion (shutdown → safe) |\n| **Coherent breathing (5.5 bpm)** | Building baseline regulation |\n| **Cold face dive reflex** | Aborting acute panic (fight-or-flight → safe) |\n| **Polyvagal awareness** | Knowing which tool to use |\n\n## What we deliberately skip\n\n- Long discussions of vagus nerve anatomy\n- Trendy "vagus nerve stimulation" devices — most are speculative\n- Trauma-specific protocols — work with a trauma-informed therapist\n\n## The single biggest mistake\n\nUsing the wrong tool for your state. If you are in shutdown, breathing exercises can deepen the freeze. If you are in fight-or-flight, NSDR can leave you wired underneath. Awareness comes first.',
  '[{"author":"Porges, S.","title":"The Polyvagal Theory","year":2011},{"author":"Dana, D.","title":"The Polyvagal Theory in Therapy","year":2018}]'::jsonb,
  1, 1, 'foundations',
  'Without the polyvagal map, you guess at which tool to use. With it, you can match the tool to the state in seconds.',
  ARRAY['Right now, identify which of the three states you are in.','Set a phone reminder 3× today to do the same scan.'],
  ARRAY['Three states, not two: safe/social, fight-or-flight, shutdown.','Each state needs DIFFERENT tools — the wrong tool can backfire.','Awareness of your state is itself a regulation skill.'],
  '[{"q":"How many autonomic states does the polyvagal model describe?","choices":["Two: stressed and calm","Three: safe/social, fight-or-flight, shutdown","Five"],"correct":1,"explain":"The third state — shutdown — is what makes polyvagal practical. Burnout, dissociation and depression live there, and they need different tools than fight-or-flight."},{"q":"Why does the wrong tool sometimes make things worse?","choices":["Tools never make things worse","Using a calming tool in shutdown can deepen the freeze; activating tools in fight-or-flight can spike further","Only psychiatric meds matter"],"correct":1,"explain":"Tools have a directional effect. State-awareness is the meta-skill that tells you which direction to push."}]'::jsonb
);

UPDATE public.vault_articles SET display_order = COALESCE(lesson_number, display_order);

COMMIT;