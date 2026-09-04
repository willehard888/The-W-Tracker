import Capacitor

/// Root bridge view controller.
///
/// Registers the App-target-local plugins (`HealthNight`, `BarcodeScan`)
/// explicitly. This is the Capacitor-documented way to register a plugin that
/// is NOT an npm package: `capacitorDidLoad()` runs after the bridge is
/// created, and `registerPluginInstance` bypasses the `autoRegisterPlugins`
/// config path.
///
/// Why not `capacitor.config.json` → `packageClassList`? Because CI runs
/// `npx cap copy ios`, which REGENERATES that list from installed npm plugins on
/// every build — silently dropping any hand-added local class. Registering in
/// code here is immune to that regeneration. Any new hand-written CAPPlugin in
/// this target goes on the list below, nowhere else.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthNight())
        bridge?.registerPluginInstance(BarcodeScan())
    }
}
