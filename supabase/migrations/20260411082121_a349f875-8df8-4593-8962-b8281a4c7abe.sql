
-- Remove duplicate badges: keep one per requirement_type+requirement_value pair
-- Level 50 duplicate: keep "Grandmaster" (bd51111c), delete "Level 50" (78317ac2)
DELETE FROM user_badges WHERE badge_id = '78317ac2-8475-4cf4-bca6-4b4be149d96d';
DELETE FROM badges WHERE id = '78317ac2-8475-4cf4-bca6-4b4be149d96d';

-- Proofs 5 duplicate: keep "Show Don't Tell" (3e94fde2), delete "Proof Poster" (62540630)
DELETE FROM user_badges WHERE badge_id = '62540630-5b89-46fd-bde0-d6eafb6aa3b2';
DELETE FROM badges WHERE id = '62540630-5b89-46fd-bde0-d6eafb6aa3b2';

-- Workouts 50 duplicate: keep "Gym Rat" (ba895bb8), delete "Iron Addict" (1204ec46)
DELETE FROM user_badges WHERE badge_id = '1204ec46-a678-4871-a8c7-c385fdfd8b41';
DELETE FROM badges WHERE id = '1204ec46-a678-4871-a8c7-c385fdfd8b41';

-- XP 50000 duplicate: keep "XP Immortal" (d0d1388c legendary), delete "50K Elite" (563c0e6f epic)
DELETE FROM user_badges WHERE badge_id = '563c0e6f-2911-401f-bb73-fcef5227773a';
DELETE FROM badges WHERE id = '563c0e6f-2911-401f-bb73-fcef5227773a';
