---
name: APNs Push Notifications
description: Direct iOS push via Apple .p8 token-based auth, ES256 JWT signing in Deno
type: feature
---
APNs sending implemented in `supabase/functions/_shared/apns.ts` using token-based auth (.p8) with ES256 JWT signed via Web Crypto. JWT cached ~50min.
Required secrets: APNS_AUTH_KEY (full .p8 PEM), APNS_KEY_ID (10-char), APNS_TEAM_ID, APNS_BUNDLE_ID (app.lovable.wtracker).
Endpoint: api.push.apple.com (production). apns-topic = bundle id.
Used by: notify-message (DM push), weekly-briefing-generate (Sunday briefing push).
Auto-cleans push_tokens on BadDeviceToken / Unregistered responses.
Only sends to tokens with platform === 'ios'. Android (FCM) not yet implemented.
