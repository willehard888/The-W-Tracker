import Foundation
import Capacitor
import HealthKit

/// The app's ONE HealthKit plugin: last night's recovery metrics (sleep stages,
/// resting HR, respiratory rate, overnight HR, HRV, SpO2), today's day snapshot
/// (steps, distance, active energy, workouts with their sport and source app,
/// mindful minutes), the newest body/fitness readings, and the two opt-in writes.
///
/// It used to share the job with the `capacitor-health` pod. That pod registers
/// itself as `HealthPlugin`, the JS looked up `Capacitor.Plugins.Health`, and
/// nothing ever imported it — so the day-snapshot half of the integration was
/// dead from 2026-05-25 (a58bd296): no auto-detect, no verified check-ins, no
/// connect card. One plugin here means one permission sheet, one registry name
/// checked in code, and access to the types that pod could not read at all
/// (VO2 max, body mass).
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
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryNight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryDay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryBody", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMealWriteAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeMeal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteMeal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWorkoutWriteAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeWorkout", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    /// Everything the app reads, requested once so iOS shows one sheet. Not on
    /// the list on purpose: workout routes / GPS and blood pressure — nothing
    /// consumes them and the privacy policy promises they are never read.
    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let categories: [HKCategoryTypeIdentifier] = [.sleepAnalysis, .mindfulSession]
        for id in categories {
            if let t = HKObjectType.categoryType(forIdentifier: id) { types.insert(t) }
        }
        let ids: [HKQuantityTypeIdentifier] = [
            // night
            .restingHeartRate, .respiratoryRate, .heartRate, .oxygenSaturation, .heartRateVariabilitySDNN,
            // day
            .stepCount, .activeEnergyBurned, .distanceWalkingRunning, .distanceCycling, .flightsClimbed,
            // body / fitness
            .bodyMass, .bodyFatPercentage, .vo2Max
        ]
        for id in ids {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        types.insert(HKObjectType.workoutType())
        return types
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
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

    // MARK: - Day snapshot (steps, distance, energy, workouts, mindful minutes)

    /// Today's aggregates in one round trip. Sums use HKStatisticsQuery, which
    /// de-duplicates overlapping sources for us — a Garmin watch and an iPhone
    /// both counting the same steps do not double. `sources` is the set of app
    /// names that contributed anything today ("Garmin Connect", "Oura", "Polar
    /// Flow", "Strava", "Apple Watch"): the visible proof a device's data arrived.
    @objc func queryDay(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }
        let end = Self.parseDate(call.getString("end")) ?? Date()
        let start = Self.parseDate(call.getString("start")) ?? Calendar.current.startOfDay(for: end)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let group = DispatchGroup()
        var result: [String: Any] = ["available": true]
        var sources = Set<String>()
        let lock = NSLock()
        func put(_ key: String, _ value: Any) { lock.lock(); result[key] = value; lock.unlock() }
        func source(_ name: String) { lock.lock(); sources.insert(name); lock.unlock() }

        func sum(_ id: HKQuantityTypeIdentifier, unit: HKUnit, key: String) {
            guard let qt = HKObjectType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let q = HKStatisticsQuery(quantityType: qt, quantitySamplePredicate: predicate, options: [.cumulativeSum, .separateBySource]) { _, stats, _ in
                if let total = stats?.sumQuantity()?.doubleValue(for: unit), total.isFinite, total > 0 {
                    put(key, total)
                }
                for src in stats?.sources ?? [] { source(src.name) }
                group.leave()
            }
            store.execute(q)
        }

        sum(.stepCount, unit: .count(), key: "steps")
        sum(.activeEnergyBurned, unit: .kilocalorie(), key: "active_kcal")
        sum(.distanceWalkingRunning, unit: .meter(), key: "distance_walk_m")
        sum(.distanceCycling, unit: .meter(), key: "distance_cycle_m")
        sum(.flightsClimbed, unit: .count(), key: "flights")

        // Workouts — count, total minutes, the longest one's sport, its source.
        group.enter()
        let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
        let wq = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: sort) { _, samples, _ in
            var list: [[String: Any]] = []
            var longest: HKWorkout?
            for case let w as HKWorkout in (samples ?? []) {
                source(w.sourceRevision.source.name)
                let kcal = w.totalEnergyBurned?.doubleValue(for: .kilocalorie())
                list.append([
                    "type": Self.workoutTypeName[w.workoutActivityType.rawValue] ?? "other",
                    "duration_s": w.duration,
                    "kcal": kcal ?? 0,
                    "source": w.sourceRevision.source.name
                ])
                if longest == nil || w.duration > longest!.duration { longest = w }
            }
            put("workouts", list)
            if let l = longest { put("primary_type", Self.workoutTypeName[l.workoutActivityType.rawValue] ?? "other") }
            group.leave()
        }
        store.execute(wq)

        // Mindful minutes — category samples, summed.
        if let mindful = HKObjectType.categoryType(forIdentifier: .mindfulSession) {
            group.enter()
            let mq = HKSampleQuery(sampleType: mindful, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var minutes = 0.0
                for s in (samples ?? []) {
                    minutes += s.endDate.timeIntervalSince(s.startDate) / 60.0
                    source(s.sourceRevision.source.name)
                }
                if minutes > 0 { put("mindful_minutes", minutes) }
                group.leave()
            }
            store.execute(mq)
        }

        group.notify(queue: .main) {
            lock.lock(); result["sources"] = Array(sources).sorted(); lock.unlock()
            call.resolve(result)
        }
    }

    // MARK: - Body & fitness (newest reading wins, like resting_hr above)

    @objc func queryBody(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }
        let end = Date()
        let start = end.addingTimeInterval(-90 * 86_400)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let group = DispatchGroup()
        let iso = ISO8601DateFormatter()
        var result: [String: Any] = ["available": true]
        let lock = NSLock()
        func put(_ key: String, _ value: Any) { lock.lock(); result[key] = value; lock.unlock() }

        func newest(_ id: HKQuantityTypeIdentifier, unit: HKUnit, key: String, scale: Double = 1) {
            guard let qt = HKObjectType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let q = HKSampleQuery(sampleType: qt, predicate: predicate, limit: 1, sortDescriptors: sort) { _, samples, _ in
                if let s = (samples as? [HKQuantitySample])?.first {
                    put(key, s.quantity.doubleValue(for: unit) * scale)
                    put(key + "_at", iso.string(from: s.endDate))
                }
                group.leave()
            }
            store.execute(q)
        }

        newest(.bodyMass, unit: .gramUnit(with: .kilo), key: "body_mass_kg")
        newest(.bodyFatPercentage, unit: .percent(), key: "body_fat_pct", scale: 100)
        // VO2 max unit is mL/(kg·min); HKUnit has no shorthand for it.
        newest(.vo2Max, unit: HKUnit(from: "ml/kg*min"), key: "vo2max")

        group.notify(queue: .main) { call.resolve(result) }
    }

    /// HKWorkoutActivityType → the camelCase names `src/lib/sports.ts`
    /// (`sportFromHealthKit`) already maps. Same table the retired
    /// capacitor-health pod used, so the sport picker keeps prefilling.
    private static let workoutTypeName: [UInt: String] = [
        1: "americanFootball", 2: "archery", 3: "australianFootball", 4: "badminton", 5: "baseball",
        6: "basketball", 7: "bowling", 8: "boxing", 9: "climbing", 10: "cricket", 11: "crossTraining",
        12: "curling", 13: "cycling", 14: "dance", 15: "danceInspiredTraining", 16: "elliptical",
        17: "equestrianSports", 18: "fencing", 19: "fishing", 20: "functionalStrengthTraining",
        21: "golf", 22: "gymnastics", 23: "handball", 24: "hiking", 25: "hockey", 26: "hunting",
        27: "lacrosse", 28: "martialArts", 29: "mindAndBody", 30: "mixedMetabolicCardioTraining",
        31: "paddleSports", 32: "play", 33: "preparationAndRecovery", 34: "racquetball", 35: "rowing",
        36: "rugby", 37: "running", 38: "sailing", 39: "skatingSports", 40: "snowSports", 41: "soccer",
        42: "softball", 43: "squash", 44: "stairClimbing", 45: "surfingSports", 46: "swimming",
        47: "tableTennis", 48: "tennis", 49: "trackAndField", 50: "traditionalStrengthTraining",
        51: "volleyball", 52: "walking", 53: "waterFitness", 54: "waterPolo", 55: "waterSports",
        56: "wrestling", 57: "yoga", 58: "barre", 59: "coreTraining", 60: "crossCountrySkiing",
        61: "downhillSkiing", 62: "flexibility", 63: "highIntensityIntervalTraining", 64: "jumpRope",
        65: "kickboxing", 66: "pilates", 67: "snowboarding", 68: "stairs", 69: "stepTraining",
        70: "wheelchairWalkPace", 71: "wheelchairRunPace", 72: "taiChi", 73: "mixedCardio",
        74: "handCycling", 75: "discSports", 76: "fitnessGaming", 77: "cardioDance", 78: "socialDance",
        79: "pickleball", 80: "cooldown", 82: "swimBikeRun", 83: "transition", 84: "underwaterDiving",
        3000: "other"
    ]

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

    // MARK: - Workout write (finished session → Apple Health)
    //
    // Opt-in like meals, and share-only for the workout type. One strength
    // workout per finished session, keyed by the session id so finishing the
    // same day twice replaces the entry instead of adding a second one.

    @objc func requestWorkoutWriteAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        Self.hkQueue.async { [store] in
            store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { success, error in
                if let error = error { call.reject(error.localizedDescription); return }
                // `success` only says the sheet was handled; the status says what
                // the athlete chose (and reflects a later change in Health › Sharing).
                let authorized = store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
                call.resolve(["granted": success && authorized])
            }
        }
    }

    @objc func writeWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        guard let sessionId = call.getString("session_id"), !sessionId.isEmpty else {
            call.reject("session_id is required")
            return
        }
        let start = Self.parseDate(call.getString("start")) ?? Date()
        // HealthKit throws (not errors) on end < start — clamp, never crash.
        let end = max(Self.parseDate(call.getString("end")) ?? start, start)
        // A runner opened and closed is not a workout.
        guard end.timeIntervalSince(start) >= 60 else {
            call.resolve(["written": false])
            return
        }

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        let metadata: [String: Any] = [
            HKMetadataKeySyncIdentifier: "wf-session-\(sessionId)",
            HKMetadataKeySyncVersion: 1
        ]

        Self.hkQueue.async {
            builder.beginCollection(withStart: start) { _, error in
                if let error = error { call.reject(error.localizedDescription); return }
                builder.addMetadata(metadata) { _, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    builder.endCollection(withEnd: end) { _, error in
                        if let error = error { call.reject(error.localizedDescription); return }
                        builder.finishWorkout { workout, error in
                            if let error = error { call.reject(error.localizedDescription); return }
                            call.resolve(["written": workout != nil])
                        }
                    }
                }
            }
        }
    }
}
