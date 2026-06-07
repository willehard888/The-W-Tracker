-- ============================================================
-- Vault: purpose-specific self-hypnosis scripts (sleep, performance
-- pressure, confidence, best-self). Same safe structure as the base
-- self-hypnosis article; honest evidence_tier + caveats in risks[].
-- Idempotent: ON CONFLICT (slug) DO NOTHING.
-- ============================================================

INSERT INTO public.vault_articles
  (category_id, slug, title, subtitle, summary, evidence_tier, read_time_min,
   benefits, risks, body_md, key_takeaways, try_today, references_json, display_order)
VALUES

('nervous-system', 'self-hypnosis-sleep',
 'Sleep hypnosis: drift down on command',
 'A wind-down script that walks you into sleep',
 'A self-hypnosis script designed for sleep onset — slow the body, quiet the mind, and let the count carry you under. Best run lying in bed with the lights out.',
 'promising', 5,
 ARRAY['Falls asleep faster','Quiets a racing mind','Builds a repeatable sleep cue'],
 ARRAY['Not a treatment for clinical insomnia or sleep disorders','If sleep problems persist for weeks, see a clinician'],
 E'Run this lying in bed, lights out, on your back. Let yourself drift — there is no "finish".\n\n**1. Settle.** Three slow breaths. Each exhale, sink a little heavier into the mattress.\n\n**2. Body release.** Move attention slowly from your feet to your head. At each part think "soft, heavy, warm" and let it go — feet, calves, thighs, hips, belly, chest, arms, hands, shoulders, neck, face.\n\n**3. Descend.** Picture a slow staircase. Count down from 20, one number per out-breath. With each number you are warmer, heavier, further from the day. If your mind wanders, just return to the count.\n\n**4. Suggestion.** Repeat slowly: "My body is heavy, my mind is quiet, sleep takes me now." Let the words blur.\n\nThere is no step to wake up — you are meant to drift off mid-script. The more nights you run it, the faster it works.',
 ARRAY['Long exhales + a slow count-down are the sleep levers','You are meant to drift off — there is no return step'],
 ARRAY['Run the count-down from 20 in bed tonight','Keep the same suggestion line every night so it becomes a cue'],
 '[{"author":"Hammond, D.C.","title":"Hypnosis in the treatment of anxiety- and stress-related disorders","year":2010},{"author":"Cordi et al.","title":"Hypnosis deepens slow-wave sleep","year":2014}]'::jsonb,
 112),

('nervous-system', 'self-hypnosis-performance-pressure',
 'Performance pressure: calm power on demand',
 'A pre-game script for the big moment',
 'A self-hypnosis routine to run before high-stakes moments — interview, competition, presentation. Down-shift the nerves, then anchor a calm, focused, ready state.',
 'promising', 5,
 ARRAY['Steadies nerves before pressure','Anchors a focused state you can recall','Turns adrenaline into fuel, not fear'],
 ARRAY['A skill, not a guarantee — pair with real preparation','Not for managing a panic disorder; see a clinician for that'],
 E'Run this 10–20 minutes before the moment. Somewhere you can close your eyes for 5 minutes.\n\n**1. Settle.** Three slow breaths, exhale longer than inhale. Tell the nerves: "This is energy. I can use it."\n\n**2. Descend (brief).** Count down 5 to 1, one per exhale, dropping into calm focus.\n\n**3. Rehearse + suggest.** See yourself in the moment doing it well — composed, clear, in command. Hold that image and repeat:\n- "I am calm, sharp and ready."\n- "Pressure makes me focus."\n- "I have done the work; now I perform."\n\n**4. Anchor.** Press thumb and forefinger together while holding the calm-ready feeling. Do this each rep so the press alone starts to recall the state. Use the anchor right before you walk in.\n\n**5. Return.** Count up 1 to 5, eyes open, alert and ready.\n\nAdrenaline is not the enemy — interpreting it as "I am ready" beats fighting it.',
 ARRAY['Reframe nerves as readiness, not threat','Build a physical anchor you can fire in the moment'],
 ARRAY['Run the script before your next high-pressure task','Practise the thumb-finger anchor so it is ready when you need it'],
 '[{"author":"Brooks, A.W.","title":"Get excited: reappraising pre-performance anxiety as excitement","year":2014}]'::jsonb,
 113),

('nervous-system', 'self-hypnosis-confidence',
 'Self-confidence: rebuild your baseline',
 'A script that installs a steadier sense of self',
 'A self-hypnosis routine to strengthen confidence — recall evidence of your own capability and rehearse a self-assured state until it becomes the default.',
 'promising', 5,
 ARRAY['Builds a steadier sense of self','Counters the inner critic with evidence','Compounds with daily practice'],
 ARRAY['Supports, does not replace, real action and skill-building','Not a treatment for low mood or anxiety disorders'],
 E'Confidence is not a feeling you wait for — it is a state you can rehearse until it sticks. 8 minutes, somewhere quiet.\n\n**1. Settle.** Three slow breaths. Let the shoulders drop.\n\n**2. Descend.** Count down 10 to 1, one per exhale, into deep calm.\n\n**3. Evidence.** Recall 2–3 specific moments you handled something well — a time you showed up, finished, or did the hard thing. Relive one in detail: what you saw, did, felt. This is real proof, not hype.\n\n**4. Suggest.** Holding that proof, repeat slowly:\n- "I trust myself to handle what comes."\n- "I have done hard things; I can do this too."\n- "I act with quiet confidence."\n\n**5. Return.** Count up 1 to 5, eyes open, standing a little taller.\n\nDo this daily for two weeks. You are not faking confidence — you are training your mind to notice the evidence it already has.',
 ARRAY['Confidence is rehearsed, not waited for','Anchor it to real evidence of your own competence'],
 ARRAY['Recall one specific win and relive it in detail today','Run the full script daily for two weeks'],
 '[{"author":"Bandura, A.","title":"Self-efficacy: The exercise of control","year":1997}]'::jsonb,
 114),

('nervous-system', 'self-hypnosis-best-self',
 'Become your best self: the future-self script',
 'Rehearse the person you are building toward',
 'A future-self visualization in self-hypnosis form — vividly rehearse the disciplined, capable version of you, then carry one concrete action back into today.',
 'promising', 6,
 ARRAY['Clarifies who you are becoming','Turns identity into daily action','Strengthens motivation and follow-through'],
 ARRAY['Visualization fuels action — it does not replace it','Pair every session with one real step today'],
 E'You become the person you repeatedly rehearse being. This script makes that deliberate. 10 minutes.\n\n**1. Settle.** Three slow breaths, exhale long. Let the day fall away.\n\n**2. Descend.** Count down 10 to 1 into deep, focused calm.\n\n**3. Meet your future self.** Picture yourself 1–2 years from now, having become your best version — disciplined, healthy, calm, strong. See how they stand, move, speak. How do they start the morning? Handle stress? Treat people? Make it vivid and specific.\n\n**4. Suggest + bridge.** Repeat slowly:\n- "I am becoming this person with every choice."\n- "I do what my best self would do."\nThen ask your future self ONE question: "What is the single thing I should do today?" Take the first answer that comes.\n\n**5. Return.** Count up 1 to 5. Eyes open. Do that one thing.\n\nIdentity drives behaviour. Rehearse the identity, then act as that person — once, today.',
 ARRAY['You become who you repeatedly rehearse being','Always leave the session with ONE concrete action'],
 ARRAY['Visualize your best self vividly, then do the one thing they would','Run this each morning for a week and track the daily action'],
 '[{"author":"Clear, J.","title":"Atomic Habits — identity-based habits","year":2018},{"author":"Oyserman et al.","title":"Possible selves and academic outcomes","year":2006}]'::jsonb,
 115)

ON CONFLICT (slug) DO NOTHING;
