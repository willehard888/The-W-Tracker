-- Admin grant, explicitly requested by the founder in chat (2026-08-18):
-- "anna Willehard ja relentlessrise admin oikeudet".
--
-- @willehard already holds admin via 20260813114055_grant_founder_admin.sql;
-- included here idempotently so this migration alone yields the requested
-- end state. relentlessrise is matched by profile username.
insert into user_roles (user_id, role)
select u.id, 'admin'::app_role
from auth.users u
where u.email in ('rasmus.willehard@icloud.com', 'rasmus.willehard@gmail.com')
on conflict do nothing;

insert into user_roles (user_id, role)
select p.user_id, 'admin'::app_role
from profiles p
where lower(p.username) = 'relentlessrise'
on conflict do nothing;
