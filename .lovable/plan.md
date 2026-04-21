

## Fix Xcode Cloud Build — Real Root Cause

### Diagnosis

The screenshot shows two layers:
1. **Warnings (yellow)**: `'NSDictionary+CordovaPreferences.o' has no symbols` + `'CDVPlugin+Resources.o' has no symbols` — these are **`libtool` warnings** when archiving the static `CapacitorCordova` framework. Categories on `NSDictionary` and `CDVPlugin` compile to "empty" `.o` files (the symbols live in the metaclass section, not the symbol table). Harmless on their own.
2. **The actual error (red)**: `Command SwiftCompile failed with a nonzero exit code` — this is in the **Capacitor** Swift target, which `import`s `CapacitorCordova`. Under Xcode 26 + `use_frameworks! :linkage => :static`, the Swift compiler can't resolve the ObjC categories from the empty-symbol-table static framework, and the previous workarounds (explicit modules off, no-verify flags) **don't address this specific failure mode**.

The real fix the Capacitor community has converged on is **switching from CocoaPods static frameworks to Swift Package Manager** for Capacitor itself. The project already has `ios/App/CapApp-SPM/Package.swift` scaffolded (visible in the user's git error log) but it's not wired into the Xcode project — the App target still links `Pods_App.framework`.

### The Plan

**Strategy A (PRIMARY — low risk, single-target change)**: Force `CapacitorCordova` to be a **dynamic** framework while keeping the rest static.

In `ios/App/Podfile`, change the linkage rules so `CapacitorCordova` is the only dynamic pod. This is the documented mixed-linkage workaround for Capacitor + Xcode 26.

**Concrete changes**:

1. **`ios/App/Podfile`** — replace top-level `use_frameworks! :linkage => :static` with per-pod overrides:
   ```ruby
   use_frameworks!  # default = dynamic
   
   def capacitor_pods
     pod 'Capacitor', :path => '...', :modular_headers => true
     pod 'CapacitorCordova', :path => '...', :modular_headers => true
     # all other pods unchanged
     pod 'RevenuecatPurchasesCapacitor', :path => '...'
   end
   ```
   Keep RevenueCat dynamic too (it's the only one that genuinely needs special module handling). Drop the `:linkage => :static` line entirely — it's the source of the symbol-stripping issue.

2. **`ios/App/Podfile` `post_install`** — simplify drastically:
   - Remove the `BUILD_LIBRARY_FOR_DISTRIBUTION = NO` overrides (only needed for static).
   - Remove `SWIFT_INSTALL_OBJC_HEADER = NO` on CapacitorCordova (only needed for static).
   - **Keep** the explicit-modules-off settings (still required under Xcode 26).
   - **Keep** the MetalToolchain path stripping.
   - **Keep** the no-verify-emitted-module-interface flag.
   - Add `MACH_O_TYPE = mh_dylib` enforcement on Capacitor pods (belt-and-suspenders).

3. **`ios/App/App/Info.plist`** — verify (no edit needed; just check) that `LSApplicationQueriesSchemes` etc. are intact after the Podfile change forces a clean install.

4. **`ios/App/ci_scripts/ci_post_clone.sh`** — add explicit logging:
   - Before `pod install`: `rm -rf Pods Podfile.lock` to force a clean install (linkage change requires it).
   - After `pod install`: print which pods are static vs dynamic (`grep -l 'static_framework' Pods/Local\ Podspecs/*.json || true`).
   - Print the Capacitor pod's `MACH_O_TYPE` from the generated xcconfig.

5. **`ios/App/ci_scripts/ci_pre_xcodebuild.sh`** — extend the sanity gate:
   - Verify `Pods-App.release.xcconfig` does NOT contain `OTHER_LDFLAGS = ... -force_load .../libCapacitorCordova.a` (that would mean it's still static).
   - Fail fast with a clear message if the linkage didn't switch.

**Strategy B (FALLBACK — only if A fails)**: Wire up the existing `CapApp-SPM` Swift Package as the Capacitor source, drop the CocoaPods Capacitor pods entirely, and keep CocoaPods only for RevenueCat. This is more invasive (Xcode project surgery to add an SPM dependency, swap framework links, regenerate `Podfile`) — defer unless A doesn't work.

### What to expect on next Xcode Cloud build

Success log signature:
```text
✅ pod install succeeded
ℹ️  CapacitorCordova: dynamic framework (mh_dylib)
✅ explicit modules disabled across all Pods xcconfigs
** ARCHIVE SUCCEEDED **
```

The `'has no symbols'` warnings will **disappear** because dynamic frameworks don't go through `libtool` archiving.

### Files touched

```text
ios/App/Podfile                              (linkage strategy changed)
ios/App/ci_scripts/ci_post_clone.sh          (clean install + diagnostics)
ios/App/ci_scripts/ci_pre_xcodebuild.sh      (linkage sanity gate)
```

No app code, no Swift code, no JS changes. No `project.pbxproj` changes. Pod cache will rebuild from scratch on Xcode Cloud (~3 min added one time).

### Risk & rollback

- **Risk: Medium-low**. Switching pod linkage is well-documented but invalidates the Pods cache; first build after this change will be slower.
- **Rollback**: revert the Podfile to `use_frameworks! :linkage => :static` — single-line change.

### After the build is green

I will then proceed (next message, separate diff) to **Phase 2A** of the polish plan: Apple Sign-In + IAP audit & fixes, per the previously approved scope. Phases 2B → 2D will follow one at a time.

### What I need from you after this lands

After deploying:
1. Pull locally — but first resolve the local conflicts you hit:
   ```bash
   cd ~/The-W-Tracker
   git stash -u
   git pull
   ```
2. Re-run the Xcode Cloud build from App Store Connect.
3. If it fails, send me the **expanded** "CapacitorCordova" or "Capacitor" group from the Xcode Cloud log — I need the actual `error:` line, not just the warnings. The summary screenshot hides it.

