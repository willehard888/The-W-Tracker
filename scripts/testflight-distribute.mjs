// Assign the newest VALID TestFlight build to the external "The W Group".
// Runs in CI after every push (see .github/workflows/testflight-distribute.yml):
// polls until Xcode Cloud's build for this push is uploaded + processed, then
// POSTs it into the external beta group so testers get Apple's notification.
// Zero deps — Node built-in crypto signs the ASC API JWT (ES256).
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (the .p8 PEM content).
import { createPrivateKey, sign } from "node:crypto";

const APP_ID = "6761115803";
const EXTERNAL_GROUP_ID = "2deaceac-99b7-40f0-8575-6218f04fe2db"; // "The W Group" (external)
const POLL_SECONDS = 60;
const MAX_MINUTES = 45; // XC archive+processing is ~10-20 min; leave slack

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_PRIVATE_KEY) {
  console.error("Missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY");
  process.exit(1);
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const key = createPrivateKey(ASC_PRIVATE_KEY);
const token = () => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }),
  );
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${b64url(sig)}`;
};

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return res;
};

const startedAt = Date.now();
// A build counts as "this push's" if uploaded after (job start - 10 min):
// the XC upload finishes minutes after the push that started this job.
const cutoff = startedAt - 10 * 60 * 1000;

for (let attempt = 1; ; attempt++) {
  const res = await api(
    `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=1&fields[builds]=version,processingState,uploadedDate`,
  );
  if (!res.ok) {
    console.error(`builds query failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const newest = (await res.json()).data?.[0];
  const { version, processingState, uploadedDate } = newest?.attributes ?? {};
  const fresh = newest && Date.parse(uploadedDate) >= cutoff;

  if (newest && processingState === "VALID" && fresh) {
    const post = await api(`/v1/betaGroups/${EXTERNAL_GROUP_ID}/relationships/builds`, {
      method: "POST",
      body: JSON.stringify({ data: [{ type: "builds", id: newest.id }] }),
    });
    // 204 = added (or already present — Apple treats re-adds as no-ops)
    if (post.status === 204) {
      console.log(`build ${version} → external group: distributed ✅`);
      process.exit(0);
    }
    console.error(`assign failed: HTTP ${post.status} ${await post.text()}`);
    process.exit(1);
  }

  if (Date.now() - startedAt > MAX_MINUTES * 60 * 1000) {
    console.error(
      `timed out after ${MAX_MINUTES} min — newest build ${version ?? "none"} ` +
        `(${processingState ?? "?"}, uploaded ${uploadedDate ?? "?"}) never became a fresh VALID build. ` +
        `Check Xcode Cloud for a failed run.`,
    );
    process.exit(1);
  }
  console.log(
    `[${attempt}] waiting — newest: ${version ?? "none"} ${processingState ?? ""}${fresh ? " (fresh)" : " (pre-push)"}`,
  );
  await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
}
