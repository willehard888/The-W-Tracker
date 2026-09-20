import Foundation
import AVFoundation
import Capacitor

/// Lets a guided recovery session be heard.
///
/// The web view's own audio stops at the lock screen and obeys the ring/silent
/// switch — right for the cue chime, wrong for a twenty-minute session done with
/// the eyes closed and the phone face down. While a voiced session runs the app
/// takes the `.playback` category (`.spokenAudio` mode, so iOS treats it as
/// speech rather than music) and hands it back at the end, so nothing else in
/// the app changes behaviour.
///
/// Registered in code from `MainViewController.capacitorDidLoad()`, like
/// `HealthNight` and `BarcodeScan` — never through `capacitor.config.json`,
/// whose plugin list `npx cap copy ios` regenerates on every build.
@objc(RecoveryAudio)
public class RecoveryAudio: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecoveryAudio"
    public let jsName = "RecoveryAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise),
    ]

    @objc func activate(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
            call.resolve()
        } catch {
            call.reject("Could not start audio: \(error.localizedDescription)")
        }
    }

    @objc func deactivate(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve()
        } catch {
            // Deactivation fails when something else is still playing; that is
            // not an error worth surfacing to a screen that has just finished.
            call.resolve()
        }
    }
}
