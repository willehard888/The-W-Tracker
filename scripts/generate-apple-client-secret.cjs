#!/usr/bin/env node
/**
 * generate-apple-client-secret.cjs
 *
 * Generates the Apple OAuth client_secret JWT for Supabase's
 * Sign in with Apple provider. Apple's "secret" is actually a signed
 * JWT that expires every 6 months (max).
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.cjs \
 *     --key-file=/path/to/AuthKey_XXXXXXXXXX.p8 \
 *     --team-id=ABCD123456 \
 *     --key-id=XYZ7890123 \
 *     --client-id=app.lovable.wtracker
 *
 * Where:
 *   --key-file  Path to the .p8 you downloaded from
 *               https://developer.apple.com/account/resources/authkeys/list
 *               (one-time download — Apple won't let you re-download)
 *   --team-id   10-char Team ID, shown top-right in Apple Developer Portal
 *   --key-id    10-char Key ID, embedded in the .p8 filename
 *               (AuthKey_<KEY_ID>.p8) and shown on the key's details page
 *   --client-id Bundle ID for native Sign in with Apple
 *               (or Services ID for web OAuth — we use bundle id since we
 *               only ship iOS native flow). Matches what you put in
 *               Supabase → Auth → Providers → Apple → Client IDs.
 *
 * Output: the JWT printed to stdout. Paste it into Supabase's
 *         Apple provider → Secret Key (for OAuth) field, then Save.
 *
 * Re-run every ~6 months before the JWT expires (Supabase shows a warning).
 *
 * The .p8 file never leaves your machine — everything is computed locally.
 */

const fs = require("fs");
const crypto = require("crypto");

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  console.error(
    "Usage:\n" +
      "  node scripts/generate-apple-client-secret.cjs \\\n" +
      "    --key-file=/path/to/AuthKey_XXXXXXXXXX.p8 \\\n" +
      "    --team-id=ABCD123456 \\\n" +
      "    --key-id=XYZ7890123 \\\n" +
      "    --client-id=app.lovable.wtracker\n",
  );
  process.exit(1);
}

function main() {
  const args = parseArgs();
  for (const required of ["key-file", "team-id", "key-id", "client-id"]) {
    if (!args[required]) die(`Missing required argument --${required}=`);
  }

  let privateKey;
  try {
    privateKey = fs.readFileSync(args["key-file"], "utf8");
  } catch (err) {
    die(`Cannot read --key-file=${args["key-file"]}: ${err.message}`);
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    die(
      `${args["key-file"]} does not look like a PEM private key — expected\n` +
        `   -----BEGIN PRIVATE KEY-----\n` +
        `   ...\n` +
        `   -----END PRIVATE KEY-----`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  // Apple max validity = 6 months = 15777000 seconds.
  const expirySeconds = 15_552_000; // 180 days, a safe buffer under Apple's hard 6-month cap.

  const header = { alg: "ES256", kid: args["key-id"], typ: "JWT" };
  const payload = {
    iss: args["team-id"],
    iat: now,
    exp: now + expirySeconds,
    aud: "https://appleid.apple.com",
    sub: args["client-id"],
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  let signatureDer;
  try {
    const signer = crypto.createSign("SHA256");
    signer.update(signingInput);
    // ES256 = ECDSA over P-256 with SHA-256.
    // `ieee-p1363` produces the raw 64-byte R||S concatenation that JWT
    // signatures require, instead of the default DER wrapping.
    signatureDer = signer.sign({
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    });
  } catch (err) {
    die(`Signing failed: ${err.message}`);
  }

  const signatureB64 = base64url(signatureDer);
  const jwt = `${signingInput}.${signatureB64}`;

  console.error("\n✅ Apple OAuth client_secret JWT generated.");
  console.error(`   iss (Team ID):  ${args["team-id"]}`);
  console.error(`   sub (Client ID): ${args["client-id"]}`);
  console.error(`   kid (Key ID):   ${args["key-id"]}`);
  console.error(`   exp:            ${new Date((now + expirySeconds) * 1000).toISOString()}`);
  console.error(
    "\n   Paste the line below into Supabase → Auth → Providers → Apple → Secret Key (for OAuth), then click Save.\n",
  );
  // Print only the JWT to stdout so the user can pipe to pbcopy if they want.
  console.log(jwt);
}

main();
