-- ============================================================
-- Vault: self-hypnosis, EFT tapping, EMDR-inspired bilateral stimulation.
-- Honest evidence tiers + explicit safety caveats in the risks[] field.
-- Clinical EMDR for trauma requires a licensed therapist — the article frames
-- the self-soothing "Butterfly Hug" as everyday down-regulation, NOT treatment.
-- Idempotent: ON CONFLICT (slug) DO NOTHING.
-- ============================================================

INSERT INTO public.vault_articles
  (category_id, slug, title, subtitle, summary, evidence_tier, read_time_min,
   benefits, risks, body_md, key_takeaways, try_today, references_json, display_order)
VALUES

-- ─────────────── NERVOUS SYSTEM — Self-hypnosis ───────────────
('nervous-system', 'self-hypnosis-downshift',
 'Self-hypnosis: a guided down-shift',
 'A focused-relaxation protocol you run on yourself',
 'A step-by-step self-hypnosis script — induction, deepening, suggestion, return — to drop into deep calm and rehearse a chosen state. Clinical hypnosis has solid evidence for relaxation, stress and pain.',
 'promising', 6,
 ARRAY['Deep, deliberate relaxation','Rehearses a calmer default state','A skill that strengthens with practice'],
 ARRAY['Not a treatment for medical or psychiatric conditions','Do not use while driving or operating machinery','If you have a serious mental-health condition, work with a clinician'],
 E'Hypnosis is not stage magic — it is focused attention plus deep relaxation, a state you can guide yourself into. Clinical hypnosis is well-evidenced for stress, sleep onset and pain management. You stay in control the whole time.\n\nSit or lie somewhere quiet. 8–10 minutes.\n\n**1. Induction (settle):**\n- Eyes closed. Take 3 slow breaths, exhale longer than you inhale.\n- Say internally: "With each breath out, I let go a little more."\n\n**2. Deepening (descend):**\n- Picture a staircase of 10 steps. Count down slowly from 10, one number per exhale.\n- With each step, feel heavier and calmer. By 1, you are deeply relaxed.\n\n**3. Suggestion (install):**\n- Pick ONE calm, present-tense line and repeat it slowly 5–10 times:\n  - "I am calm, steady and in control."\n  - "Sleep comes easily to me tonight."\n  - "I handle pressure with a clear, quiet mind."\n\n**4. Return (resurface):**\n- Count up 1 to 5. At 5, eyes open, alert and refreshed.\n\nDone nightly, the suggestion becomes more automatic. Keep the line short, positive and present-tense.',
 ARRAY['Hypnosis = focused attention + deep relaxation; you stay in control','One short, present-tense suggestion, repeated, is the active ingredient'],
 ARRAY['Run the full 4-step script once before bed tonight','Choose your single suggestion line and keep it for a week'],
 '[{"author":"Montgomery et al.","title":"A meta-analysis of hypnotically induced analgesia","year":2000},{"author":"Hammond, D.C.","title":"Hypnosis in the treatment of anxiety- and stress-related disorders","year":2010}]'::jsonb,
 110),

-- ─────────────── MIND — EFT tapping ───────────────
('mind', 'eft-tapping-sequence',
 'EFT tapping: the point-by-point sequence',
 'Acupressure tapping for acute stress — what it is, honestly',
 'A complete EFT (Emotional Freedom Technique) round: the setup statement, the eight tapping points and the reminder phrase. Evidence is mixed and debated — treat it as a calming ritual, not a cure.',
 'speculative', 5,
 ARRAY['A structured ritual that interrupts rumination','Pairs naming the problem with self-soothing touch','Quick and portable'],
 ARRAY['Evidence is mixed and contested — effects may be largely relaxation/placebo','Not a substitute for therapy for trauma or clinical anxiety'],
 E'EFT ("tapping") combines naming a stressor with light tapping on acupressure points. The research is genuinely mixed — some trials show benefit, critics attribute it to relaxation, distraction and exposure. Use it as a calming ritual with honest expectations.\n\n**1. Rate it.** Name the feeling and rate intensity 0–10. ("This deadline stress — 7.")\n\n**2. Setup (tap the karate-chop point, side of hand), say 3×:**\n"Even though I feel this [stress], I deeply and completely accept myself."\n\n**3. Tap each point ~5–7 times** while repeating a short reminder phrase ("this stress"):\n- Eyebrow (inner brow)\n- Side of eye\n- Under eye\n- Under nose\n- Chin crease\n- Collarbone\n- Under arm (~10cm below armpit)\n- Top of head\n\n**4. Re-rate** 0–10. Repeat a round or two until it drops.\n\nThe mechanism that almost certainly does work here: you stop, name the feeling, breathe and self-soothe. That alone is worth five minutes.',
 ARRAY['EFT is a structured calming ritual — be honest that the evidence is debated','Naming the feeling + slowing down is the reliable part'],
 ARRAY['Run one full tapping round on something bugging you now','Re-rate 0–10 before and after to see your own response'],
 '[{"author":"Church et al.","title":"Clinical EFT as an evidence-based practice (review)","year":2018},{"author":"Note","title":"Evidence is contested; several reviews attribute effects to nonspecific factors"}]'::jsonb,
 110),

-- ─────────────── MIND — EMDR-inspired bilateral stimulation ───────────────
('mind', 'bilateral-butterfly-hug',
 'Bilateral stimulation: the Butterfly Hug',
 'An EMDR-inspired self-soothing tool — with clear limits',
 'A simple bilateral (left-right) self-stimulation technique adapted from EMDR for calming everyday distress. Important: clinical EMDR for trauma must be done with a trained therapist — this is self-soothing, not treatment.',
 'speculative', 4,
 ARRAY['Calms acute everyday distress','Rhythmic, grounding, portable','Easy to learn in one read'],
 ARRAY['NOT trauma therapy — real EMDR requires a licensed EMDR clinician','Can surface strong emotion; stop if you feel overwhelmed and seek support','Not for processing serious trauma alone'],
 E'EMDR is a structured, clinician-led therapy for trauma built around bilateral (left-right) stimulation. **Do not try to process trauma on your own.** What you *can* safely borrow is the bilateral rhythm as a grounding, self-soothing tool for ordinary stress — known as the **Butterfly Hug**.\n\n**The Butterfly Hug (2–4 min):**\n1. Cross your arms over your chest, hands resting on opposite shoulders/upper arms.\n2. Gently tap left, then right, then left… slow and steady, like a butterfly''s wings.\n3. Breathe slowly. Let your attention rest on the rhythm and the present moment.\n4. Continue 1–2 minutes; notice your body settle.\n\nAlternatives: tap alternate knees, or step left-right in place. The point is a slow, alternating, bilateral rhythm paired with calm breathing.\n\nUse it to come down from acute stress, before sleep, or to ground after a hard moment. For trauma, EMDR works — but with a professional, not from an app.',
 ARRAY['Borrow the bilateral rhythm for self-soothing — not for trauma processing','Real EMDR is clinician-led; see a licensed therapist for trauma'],
 ARRAY['Try the Butterfly Hug for 2 minutes next time you feel wound up','Pair the taps with slow exhales'],
 '[{"author":"Shapiro, F.","title":"Eye Movement Desensitization and Reprocessing (EMDR) Therapy","year":2018},{"author":"Artigas & Jarero","title":"The Butterfly Hug method for bilateral stimulation","year":2014}]'::jsonb,
 111)

ON CONFLICT (slug) DO NOTHING;
