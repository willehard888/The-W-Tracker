# Migrate iOS builds to Codemagic

Xcode Cloud has been unable to build the iOS shell since build 778
because its scheduler ignores `PBXTargetDependency` for Swift module
resolution and refuses to honour `xcodebuild -jobs 1` from CI scripts.
12 incremental workarounds (modular_headers, @import patches, static
linkage, pre-built mirror, `SWIFT_USE_INTEGRATED_DRIVER = NO`, …) all
hit the same race on whichever Capacitor plugin Xcode happens to
schedule first.

Codemagic exposes the full xcodebuild command line, so we can pass
`-jobs 1` directly. That's the one knob that deterministically ends
the module race. Slower by ~1 minute per archive; reliably green.

This is a one-time setup that takes ~15 minutes.

---

## 1. Create the Codemagic account (free tier)

1. Sign up at https://codemagic.io with your GitHub account
2. After auth, choose **Add application** → **From GitHub** →
   pick `willehard888/The-W-Tracker`
3. When asked "Which workflow?", select **codemagic.yaml** (committed in
   repo root)

## 2. Connect App Store Connect

Codemagic needs an App Store Connect API key to upload to TestFlight.

1. **Generate the key** at
   https://appstoreconnect.apple.com/access/integrations/api/team
   - Click **+** → **Generate API Key**
   - Name: `Codemagic`
   - Access: **App Manager** (minimum needed for TestFlight upload)
   - Download the `.p8` file (one-time download — save it!)
   - Copy the **Key ID** and **Issuer ID** from the same page

2. **Add the integration** in Codemagic:
   - Dashboard → **Teams** → **Personal Account** → **Integrations**
   - **App Store Connect** → **Connect**
   - Name: `codemagic`  *(must match `auth: integration` in codemagic.yaml)*
   - Paste **Issuer ID**, **Key ID**, and upload the `.p8` file
   - Click **Save**

## 3. Add code-signing variables

In Codemagic dashboard → Teams → **Personal Account** → **Variables**:

Create a new group called **wtracker_ios** with these encrypted vars:

| Variable | Value |
|---|---|
| `APP_STORE_CONNECT_PRIVATE_KEY` | Contents of the `.p8` file you downloaded (entire `-----BEGIN PRIVATE KEY-----…END PRIVATE KEY-----` block) |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | The Key ID from App Store Connect (10 chars, e.g. `ABC123XYZ4`) |
| `APP_STORE_CONNECT_ISSUER_ID` | The Issuer ID (UUID, e.g. `12345678-…-…`) |
| `CERTIFICATE_PRIVATE_KEY` | Distribution certificate private key (next section) |
| `APP_STORE_APP_ID` | `6761115803` (your app's id on App Store Connect) |

Tick **Make secure** on every variable.

### Generate the distribution certificate private key

```bash
# On your Mac, in the W Tracker repo root:
ssh-keygen -t rsa -b 4096 -f /tmp/codemagic_cert_key -N ""
cat /tmp/codemagic_cert_key
```

Copy the full output (`-----BEGIN PRIVATE KEY-----…END PRIVATE KEY-----`)
into `CERTIFICATE_PRIVATE_KEY`. Codemagic uses this to fetch or generate
your distribution certificate from Apple.

## 4. Trigger the first build

Two ways:

**Manual** (recommended for the first build):
- Codemagic dashboard → **Applications** → W Tracker → **Start new build**
- Branch: `main` → Workflow: `ios-testflight` → **Start build**

**Automatic** (every push to main):
- `codemagic.yaml` already has this enabled — every `git push` to main
  starts a build automatically.

The first build pulls dependencies cold and takes ~12 minutes. Watch
the live log; the **`xcodebuild archive (serial, -jobs 1)`** step is
where we'll see whether the race is gone.

## 5. Disable Xcode Cloud

Once Codemagic produces a green TestFlight build:

1. Open Xcode → Window → **Cloud → Manage Workflows**
2. Disable or delete the existing W Tracker workflows
3. (Optional) App Store Connect → TestFlight → Manage workflows →
   disconnect Xcode Cloud entirely

Two CIs running in parallel would double-upload TestFlight builds and
cause confusing version-number collisions.

---

## What if Codemagic also fails?

Extremely unlikely with `-jobs 1`, but if so the next-best options:

- **GitHub Actions on macOS runners** — same xcodebuild control, free
  for public repos / 2000 min/mo for private. The .yaml is similar
  shape; can write one if needed.
- **Bitrise** — same idea, more iOS-specific UI. Free tier 200
  build minutes/mo.
- **Local Archive + Xcode Organizer upload** — manual, but bulletproof.
  `Product → Archive` in Xcode, then `Distribute App → App Store Connect`.

## Why we picked Codemagic over the alternatives

| | Codemagic | GitHub Actions | Bitrise |
|---|---|---|---|
| Native iOS support | ✅ first-class | 🟡 generic Mac runner | ✅ first-class |
| `xcodebuild -jobs N` control | ✅ direct | ✅ direct | ✅ direct |
| Free tier | 500 min/mo | 2000 min/mo (private) | 200 min/mo |
| App Store Connect integration | ✅ built-in | 🟡 via Fastlane | ✅ built-in |
| Capacitor docs / examples | ✅ official guide | 🟡 community | 🟡 community |

GitHub Actions has more free minutes but Codemagic's iOS pipeline is
purpose-built — less yaml, fewer moving parts. Switch to Actions if
the free minutes run out.
