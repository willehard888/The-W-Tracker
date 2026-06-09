-- ============================================================
-- Rename the subscription/membership badge.
-- The `elite_member` badge is awarded from is_elite (the PAID membership
-- flag), not from EARNED Elite status (status_tier). Calling it "Elite Member"
-- implied buying = Elite, which contradicts "Elite is earned, not bought".
-- Reframe it as a membership/supporter badge.
-- ============================================================
UPDATE public.badges
SET name        = 'One of the Winners',
    description = 'Premium member — you went all in. One of the winners backing the mission.',
    icon        = '🏆'
WHERE requirement_type = 'elite_member';
