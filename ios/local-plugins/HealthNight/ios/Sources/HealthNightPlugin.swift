import Foundation
import Capacitor
import HealthKit

/// Reads last night's recovery metrics from HealthKit (sleep stages, resting HR,
/// respiratory rate, overnight HR, SpO2) for the Causal Health engine. Pure
/// Swift + modern CAPBridgedPlugin registration (auto-discovered), so it avoids
/// the mixed Swift/ObjC module problem that broke the third-party plugin.
@objc(HealthNightPlugin)
public class HealthNightPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthNightPlugin"
    public let jsName = "HealthNight"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryNight", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        let ids: [HKQuantityTypeIdentifier] = [.restingHeartRate, .respiratoryRate, .heartRate, .oxygenSaturation]
        for id in ids {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        return types
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: nil, read: readTypes()) { success, _ in
            call.resolve(["granted": success])
        }
    }

    @objc func queryNight(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }

        let end = Date()
        let start = end.addingTimeInterval(-20 * 3600) // wide enough to catch the whole night
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let group = DispatchGroup()
        let iso = ISO8601DateFormatter()
        var result: [String: Any] = ["available": true]
        let lock = NSLock()
        func put(_ key: String, _ value: Any) { lock.lock(); result[key] = value; lock.unlock() }

        // --- Sleep stages (HKCategoryValueSleepAnalysis raw values, no iOS-16 enum refs) ---
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let q = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var deep = 0.0, rem = 0.0, core = 0.0, awake = 0.0
                var sStart: Date?
                var sEnd: Date?
                for case let s as HKCategorySample in (samples ?? []) {
                    let mins = s.endDate.timeIntervalSince(s.startDate) / 60.0
                    switch s.value {
                    case 0: continue          // inBed
                    case 2: awake += mins; continue // awake
                    case 4: deep += mins      // asleepDeep
                    case 5: rem += mins       // asleepREM
                    default: core += mins     // 1 asleepUnspecified, 3 asleepCore
                    }
                    if sStart == nil || s.startDate < sStart! { sStart = s.startDate }
                    if sEnd == nil || s.endDate > sEnd! { sEnd = s.endDate }
                }
                put("sleep_deep_min", Int(deep.rounded()))
                put("sleep_rem_min", Int(rem.rounded()))
                put("sleep_core_min", Int(core.rounded()))
                put("awake_min", Int(awake.rounded()))
                put("sleep_total_min", Int((deep + rem + core).rounded()))
                if let st = sStart { put("sleep_start", iso.string(from: st)) }
                if let en = sEnd { put("sleep_end", iso.string(from: en)) }
                group.leave()
            }
            store.execute(q)
        }

        let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())

        func quantity(_ id: HKQuantityTypeIdentifier, unit: HKUnit, key: String, reduce: @escaping ([Double]) -> Double?) {
            guard let qt = HKObjectType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)]
            let q = HKSampleQuery(sampleType: qt, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: sort) { _, samples, _ in
                let vals = (samples as? [HKQuantitySample])?.map { $0.quantity.doubleValue(for: unit) } ?? []
                if let v = reduce(vals) { put(key, v) }
                group.leave()
            }
            store.execute(q)
        }

        let avg: ([Double]) -> Double? = { xs in xs.isEmpty ? nil : xs.reduce(0, +) / Double(xs.count) }

        quantity(.restingHeartRate, unit: bpm, key: "resting_hr") { $0.last }        // newest
        quantity(.respiratoryRate, unit: bpm, key: "respiratory_rate", reduce: avg)
        quantity(.heartRate, unit: bpm, key: "avg_hr", reduce: avg)
        quantity(.heartRate, unit: bpm, key: "min_hr") { $0.min() }
        quantity(.oxygenSaturation, unit: HKUnit.percent(), key: "spo2") { xs in
            xs.isEmpty ? nil : (xs.reduce(0, +) / Double(xs.count)) * 100.0
        }

        group.notify(queue: .main) {
            call.resolve(result)
        }
    }
}
