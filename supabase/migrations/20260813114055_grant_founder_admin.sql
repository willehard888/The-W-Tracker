-- Founder admin grant (explicitly requested by the founder in chat).
-- user_roles was completely empty in prod, so the entire admin surface
-- (/admin/metrics Command Center, moderation queue, legend invites, weekly
-- founder digest) had zero eligible users. Grants admin to both founder
-- accounts, matched by auth email so this is a no-op on any other database:
--   @willehard     rasmus.willehard@icloud.com  (main account, Apple Sign-In)
--   @mogger_ccd191 rasmus.willehard@gmail.com   (secondary/web account)
insert into user_roles (user_id, role)
select u.id, 'admin'::app_role
from auth.users u
where u.email in ('rasmus.willehard@icloud.com', 'rasmus.willehard@gmail.com')
on conflict do nothing;
