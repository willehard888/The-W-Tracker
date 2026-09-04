import Foundation
import Capacitor
import HealthKit

/// Reads last night's recovery metrics from HealthKit (sleep stages, resting HR,
/// respiratory rate, overnight HR, SpO2) for the Causal Health engine.
///
/// This is compiled DIRECTLY INTO THE APP TARGET and registered in code from
/// `MainViewController.capacitorDidLoad()` (via `bridge.registerPluginInstance`),
/// NOT as a separate CocoaPods pod and NOT via `capacitor.config.json`.
/// Rationale:
///   1. Under Xcode 26.5 a stand-alone Swift pod cannot resolve `import Capacitor`
///      during its own module emit ("no such module 'Capacitor'" — this broke both
///      @perfood and the earlier HealthNight pod). The App target already links +
///      imports Capacitor (see AppDelegate.swift), so the module resolves cleanly.
///   2. CI runs `npx cap copy ios`, which regenerates `packageClassList` from npm
///      plugins every build — so config-based auto-registration would silently drop
///      a local class. Explicit `registerPluginInstance` is immune to that.
@objc(HealthNight)
public class HealthNight: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthNight"
    public let jsName = "HealthNight"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryNight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMealWriteAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeMeal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteMeal", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        let ids: [HKQuantityTypeIdentifier] = [.restingHeartRate, .respiratoryRate, .heartRate, .oxygenSaturation, .heartRateVariabilitySDNN]
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
        // HRV (SDNN, ms) — Apple Watch samples this a few times per night; the
        // overnight average is the recovery signal the Whealth Index reads.
        quantity(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), key: "hrv_sdnn", reduce: avg)

        group.notify(queue: .main) {
            call.resolve(result)
        }
    }

    // MARK: - Meal write (Nutrition diary → Apple Health)
    //
    // Opt-in, separate from the read-only `requestAuthorization` above (which
    // night-metrics.ts calls on every sync and must stay share-free). One
    // HKQuantitySample per present nutrient, wrapped in a `.food` correlation
    // tagged with the meal id so an edit or delete can find it again.

    /// JS key → HealthKit dietary type + unit. Order = sample order, nothing more.
    private static let mealNutrients: [(key: String, id: HKQuantityTypeIdentifier, unit: HKUnit)] = [
        ("kcal", .dietaryEnergyConsumed, .kilocalorie()),
        ("protein_g", .dietaryProtein, .gram()),
        ("carbs_g", .dietaryCarbohydrates, .gram()),
        ("fat_g", .dietaryFatTotal, .gram()),
        ("water_ml", .dietaryWater, .literUnit(with: .milli)),
        ("caffeine_mg", .dietaryCaffeine, .gramUnit(with: .milli))
    ]

    private static let foodType = HKObjectType.correlationType(forIdentifier: .food)!
    private static let hkQueue = DispatchQueue(label: "app.wtracker.healthkit.meals", qos: .utility)

    private func mealShareTypes() -> Set<HKSampleType> {
        var types = Set<HKSampleType>()
        for n in Self.mealNutrients {
            if let t = HKObjectType.quantityType(forIdentifier: n.id) { types.insert(t) }
        }
        return types
    }

    /// ISO-8601 with or without fractional seconds (JS `toISOString()` has them).
    private static func parseDate(_ s: String?) -> Date? {
        guard let s = s, !s.isEmpty else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }

    /// Every correlation (plus its samples) this app saved under `mealId`.
    private func mealObjects(_ mealId: String, _ completion: @escaping ([HKObject], Error?) -> Void) {
        let predicate = HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeyExternalUUID, allowedValues: [mealId])
        let q = HKSampleQuery(sampleType: Self.foodType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            var objects: [HKObject] = []
            for case let c as HKCorrelation in (samples ?? []) {
                objects.append(contentsOf: c.objects)
                objects.append(c)
            }
            completion(objects, error)
        }
        store.execute(q)
    }

    /// Deletes all objects for `mealId`; completes with the number removed.
    private func purgeMeal(_ mealId: String, _ completion: @escaping (Int, Error?) -> Void) {
        mealObjects(mealId) { [store] objects, error in
            if let error = error { completion(0, error); return }
            guard !objects.isEmpty else { completion(0, nil); return }
            store.delete(objects) { ok, error in completion(ok ? objects.count : 0, error) }
        }
    }

    @objc func requestMealWriteAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        Self.hkQueue.async { [store, types = mealShareTypes()] in
            store.requestAuthorization(toShare: types, read: []) { success, error in
                if let error = error { call.reject(error.localizedDescription); return }
                call.resolve(["granted": success])
            }
        }
    }

    @objc func writeMeal(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        guard let mealId = call.getString("meal_id"), !mealId.isEmpty else {
            call.reject("meal_id is required")
            return
        }
        let name = call.getString("name") ?? "Meal"
        let start = Self.parseDate(call.getString("start")) ?? Date()
        // HealthKit throws (not errors) on end < start — clamp, never crash.
        let end = max(Self.parseDate(call.getString("end")) ?? start, start)
        let version = call.getInt("version") ?? 1

        var samples = Set<HKSample>()
        for n in Self.mealNutrients {
            // Negative/NaN values also throw inside HealthKit — skip them.
            guard let value = call.getDouble(n.key), value.isFinite, value >= 0,
                  let type = HKObjectType.quantityType(forIdentifier: n.id) else { continue }
            samples.insert(HKQuantitySample(
                type: type,
                quantity: HKQuantity(unit: n.unit, doubleValue: value),
                start: start,
                end: end,
                metadata: [HKMetadataKeySyncIdentifier: "wf-meal-\(mealId)-\(n.key)", HKMetadataKeySyncVersion: version]
            ))
        }
        guard !samples.isEmpty else {
            call.resolve(["written": false])
            return
        }
        let correlation = HKCorrelation(
            type: Self.foodType,
            start: start,
            end: end,
            objects: samples,
            metadata: [HKMetadataKeyFoodType: name, HKMetadataKeyExternalUUID: mealId]
        )
        let count = samples.count
        Self.hkQueue.async { [store] in
            // Sync identifiers replace the nutrient samples on edit, but the
            // previous correlation shell would linger — drop it first (best effort).
            self.purgeMeal(mealId) { _, _ in
                store.save(correlation) { ok, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    call.resolve(["written": ok, "samples": count])
                }
            }
        }
    }

    @objc func deleteMeal(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        guard let mealId = call.getString("meal_id"), !mealId.isEmpty else {
            call.reject("meal_id is required")
            return
        }
        Self.hkQueue.async {
            self.purgeMeal(mealId) { deleted, error in
                if let error = error { call.reject(error.localizedDescription); return }
                call.resolve(["deleted": deleted])
            }
        }
    }
}
