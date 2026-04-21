

## Fix Xcode Cloud Build — `SwiftCompile failed (exit 65)` in Capacitor

### Root cause

Xcode Cloud uses **Xcode 26**, which enables Swift **explicit modules** by default. The project uses `use_frameworks! :linkage => :static` and links the Objective-C `CapacitorCordova` pod into the Swift `Capacitor` pod. Under explicit modules + static frameworks, the `Capacitor` Swift module fails to compile against the `CapacitorCordova` ObjC headers — exactly matching the screenshot:

- ❌ `Command SwiftCompile failed` inside the **Capacitor** target
- ⚠️ `'NSDictionary+CordovaPreferences.o' has no symbols` / `'CDVPlugin+Resources.o' has no symbols` (CapacitorCordova not emitting a usable module)
- ⚠️ `[CP] Copy Pods Resources` script phase has no declared outputs (cosmetic, but Xcode 26 escalates it)

The current Podfile already sets `SWIFT_ENABLE_EXPLICIT_MODULES = NO` and `CLANG_ENABLE_EXPLICIT_MODULES = NO` on pod targets, but **does not** apply the same to the App target's xcconfig that `xcodebuild archive` actually uses on CI, and is missing the documented Xcode 26 workaround flag for the static-framework + Cordova combo.

### What I will change

**1. `ios/App/Podfile` — patch the `post_install` block**

- Force-disable explicit modules **everywhere** (pod targets AND the user App target's xcconfig — both Debug and Release).
- Add `OTHER_SWIFT_FLAGS = "$(inherited) -Xfrontend -no-verify-emitted-module-interface"` to the `Capacitor` and `RevenuecatPurchasesCapacitor` pods. This is the official workaround for Swift module-interface verification failures under Xcode 26 with static frameworks.
- Set `SWIFT_INSTALL_OBJC_HEADER = NO` on the `CapacitorCordova` target so the ObjC-only pod stops trying to emit a (non-existent) Swift header that Xcode 26 then tries to re-import.
- Declare an output path on the `[CP] Copy Pods Resources` script phase via `installer.pods_project` to silence the script-phase warning that Xcode Cloud sometimes treats as an error in strict mode.
- Bump explicit `BUILD_LIBRARY_FOR_DISTRIBUTION = NO` on all pod targets (incompatible with our static-framework setup and silently flipped on by Xcode 26).

**2. `ios/App/App.xcodeproj/project.pbxproj` — App target build settings**

Add to both Debug and Release configs (504EC3171FED…, 504EC3181FED…):
- `SWIFT_ENABLE_EXPLICIT_MODULES = NO`
- `CLANG_ENABLE_EXPLICIT_MODULES = NO`
- `OTHER_SWIFT_FLAGS = "$(inherited) -Xfrontend -no-verify-emitted-module-interface"`
- `SWIFT_VERIFY_EMITTED_MODULE_INTERFACE = NO`

These survive even when `pod install` regenerates xcconfigs, because they live on the App target itself.

**3. `ios/App/ci_scripts/ci_post_clone.sh` — strengthen the patcher**

Extend the existing Python patcher to also:
- Inject `SWIFT_VERIFY_EMITTED_MODULE_INTERFACE = NO` into every generated `*.xcconfig`.
- Strip any stray `-verify-emitted-module-interface` flag the Capacitor pod injects.
- Verify by grepping the resulting `Pods-App.release.xcconfig` and failing fast (with a clear message) if explicit modules are still enabled.

**4. `ios/App/ci_scripts/ci_pre_xcodebuild.sh` — add a sanity gate**

Right before xcodebuild runs, fail with a clear message if any xcconfig still contains `SWIFT_ENABLE_EXPLICIT_MODULES = YES` — turns a 30-min compile failure into a 5-second early exit with actionable output.

### Verification path

After deploy:
```text
git pull
bash scripts/ios-rebuild.sh        # local dry-run on macOS
```
If local archive passes, Xcode Cloud will too — the same patcher runs there.

Expected Xcode Cloud log signature on success:
```text
✅ Pods installed successfully
✅ explicit modules disabled in Pods-App.release.xcconfig
** ARCHIVE SUCCEEDED **
```

### Files touched

```text
ios/App/Podfile                              (post_install hardened)
ios/App/App.xcodeproj/project.pbxproj        (4 build settings × 2 configs)
ios/App/ci_scripts/ci_post_clone.sh          (patcher extended)
ios/App/ci_scripts/ci_pre_xcodebuild.sh      (sanity gate added)
```

No app code, JS, or Capacitor plugin code changes. No `pod install` output changes locally — only build settings.

### Risk & rollback

Low risk: all changes are build-time settings scoped to iOS/CocoaPods. No runtime behavior change. Rollback = revert these four files.

### Out of scope (deferred)

- The daily check-in 24h lock screen — tracked separately, not bundled into this CI fix to keep the diff reviewable.

