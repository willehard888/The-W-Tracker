import Foundation
import Capacitor
import AVFoundation
import UIKit

/// In-house barcode scanner (EAN-8 / EAN-13 / UPC-E) on top of AVFoundation's
/// `AVCaptureMetadataOutput`. UPC-A arrives as EAN-13 with a leading 0.
///
/// Replaces `@capacitor-mlkit/barcode-scanning`: the GoogleMLKit pods inject
/// `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`, which makes every simulator
/// destination ineligible on Apple Silicon. AVFoundation decodes the retail
/// symbologies natively, needs no dependency and builds for every arch.
///
/// Like `HealthNight`, this is compiled DIRECTLY INTO THE APP TARGET and
/// registered in code from `MainViewController.capacitorDidLoad()` — see that
/// file and HealthNight.swift for why (no stand-alone pod, and `cap copy`
/// regenerates `packageClassList`).
@objc(BarcodeScan)
public class BarcodeScan: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarcodeScan"
    public let jsName = "BarcodeScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    /// JS format name ↔ AVFoundation symbology. Order = default scan order, nothing more.
    fileprivate static let formats: [(name: String, type: AVMetadataObject.ObjectType)] = [
        ("EAN_8", .ean8),
        ("EAN_13", .ean13),
        ("UPC_E", .upce)
    ]

    private static func permissionState() -> String {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return "granted"
        case .denied, .restricted: return "denied"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": AVCaptureDevice.default(for: .video) != nil])
    }

    // CAPPlugin declares both permission hooks — override, don't redeclare.
    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["camera": Self.permissionState()])
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        AVCaptureDevice.requestAccess(for: .video) { _ in
            call.resolve(["camera": Self.permissionState()])
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("settings_unavailable")
                return
            }
            UIApplication.shared.open(url) { _ in call.resolve() }
        }
    }

    @objc func scan(_ call: CAPPluginCall) {
        let wanted = call.getArray("formats", String.self) ?? []
        var types = Self.formats.filter { wanted.contains($0.name) }.map { $0.type }
        if types.isEmpty { types = Self.formats.map { $0.type } } // default / unknown names → all three

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            present(call, types: types)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted { self.present(call, types: types) } else { Self.resolveDenied(call) }
            }
        default:
            Self.resolveDenied(call)
        }
    }

    private static func resolveDenied(_ call: CAPPluginCall) {
        call.resolve(["barcode": NSNull(), "denied": true])
    }

    private func present(_ call: CAPPluginCall, types: [AVMetadataObject.ObjectType]) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else {
                call.reject("camera_unavailable")
                return
            }
            let scanner = ScannerViewController(types: types) { outcome in
                switch outcome {
                case .code(let value, let type):
                    let name = Self.formats.first { $0.type == type }?.name ?? "EAN_13"
                    call.resolve(["barcode": ["rawValue": value, "format": name]])
                case .cancelled:
                    call.resolve(["barcode": NSNull(), "cancelled": true])
                }
            }
            // Configure the session BEFORE presenting so a missing camera (simulator)
            // rejects cleanly instead of showing a black screen.
            scanner.prepare { ok in
                guard ok else {
                    call.reject("camera_unavailable")
                    return
                }
                host.present(scanner, animated: true)
            }
        }
    }
}

// MARK: - Scanner screen

private final class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    enum Outcome {
        case code(String, AVMetadataObject.ObjectType)
        case cancelled
    }

    private let types: [AVMetadataObject.ObjectType]
    private let onFinish: (Outcome) -> Void
    private let session = AVCaptureSession()
    private let output = AVCaptureMetadataOutput()
    private let sessionQueue = DispatchQueue(label: "app.wtracker.barcodescan.session", qos: .userInitiated)
    private var device: AVCaptureDevice?
    private var finished = false

    private lazy var preview = AVCaptureVideoPreviewLayer(session: session)
    private let dim = CAShapeLayer()
    private let window = UIView()
    private let hint = UILabel()
    private let torchButton = UIButton(type: .system)

    init(types: [AVMetadataObject.ObjectType], onFinish: @escaping (Outcome) -> Void) {
        self.types = types
        self.onFinish = onFinish
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
    override var prefersStatusBarHidden: Bool { true }

    /// Builds the capture graph off the main thread; completes on main with success.
    func prepare(_ completion: @escaping (Bool) -> Void) {
        sessionQueue.async {
            let ok = self.configureSession()
            DispatchQueue.main.async { completion(ok) }
        }
    }

    private func configureSession() -> Bool {
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
                ?? AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera) else { return false }

        session.beginConfiguration()
        defer { session.commitConfiguration() }
        if session.canSetSessionPreset(.high) { session.sessionPreset = .high }
        guard session.canAddInput(input), session.canAddOutput(output) else { return false }
        session.addInput(input)
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        let available = output.availableMetadataObjectTypes
        output.metadataObjectTypes = types.filter { available.contains($0) }
        guard !output.metadataObjectTypes.isEmpty else { return false }
        device = camera
        return true
    }

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)

        dim.fillRule = .evenOdd
        dim.fillColor = UIColor.black.withAlphaComponent(0.55).cgColor
        view.layer.addSublayer(dim)

        window.layer.cornerRadius = 16
        window.layer.borderWidth = 1
        window.layer.borderColor = UIColor.white.withAlphaComponent(0.7).cgColor
        window.backgroundColor = .clear
        window.isUserInteractionEnabled = false

        hint.text = "Point at the barcode"
        hint.textColor = UIColor.white.withAlphaComponent(0.85)
        hint.font = .systemFont(ofSize: 15, weight: .medium)
        hint.textAlignment = .center

        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(.white, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        torchButton.tintColor = .white
        torchButton.setImage(UIImage(systemName: "bolt.slash.fill"), for: .normal)
        torchButton.addTarget(self, action: #selector(torchTapped), for: .touchUpInside)
        torchButton.isHidden = !(device?.hasTorch ?? false)

        for v in [window, hint, cancel, torchButton] {
            v.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(v)
        }
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            window.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            window.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            window.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.8),
            window.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.35),

            hint.topAnchor.constraint(equalTo: window.bottomAnchor, constant: 16),
            hint.leadingAnchor.constraint(equalTo: window.leadingAnchor),
            hint.trailingAnchor.constraint(equalTo: window.trailingAnchor),

            cancel.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 8),
            cancel.topAnchor.constraint(equalTo: safe.topAnchor, constant: 8),
            cancel.heightAnchor.constraint(equalToConstant: 44),
            cancel.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),

            torchButton.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -8),
            torchButton.topAnchor.constraint(equalTo: safe.topAnchor, constant: 8),
            torchButton.heightAnchor.constraint(equalToConstant: 44),
            torchButton.widthAnchor.constraint(equalToConstant: 44)
        ])

        NotificationCenter.default.addObserver(self, selector: #selector(sessionStarted),
                                               name: .AVCaptureSessionDidStartRunning, object: session)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview.frame = view.bounds
        dim.frame = view.bounds
        let path = UIBezierPath(rect: view.bounds)
        path.append(UIBezierPath(roundedRect: window.frame, cornerRadius: window.layer.cornerRadius))
        dim.path = path.cgPath
        updateRectOfInterest()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        sessionQueue.async { [session] in
            if !session.isRunning { session.startRunning() }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sessionQueue.async { [session] in
            if session.isRunning { session.stopRunning() }
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        finish(.cancelled) // no-op if already finished; covers an external dismissal
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    // MARK: Actions

    /// The layer→metadata rect conversion only knows the video dimensions once the
    /// session runs, so refresh it on layout AND on session start.
    @objc private func sessionStarted() {
        DispatchQueue.main.async { self.updateRectOfInterest() }
    }

    private func updateRectOfInterest() {
        guard preview.connection != nil, !window.frame.isEmpty else { return }
        output.rectOfInterest = preview.metadataOutputRectConverted(fromLayerRect: window.frame)
    }

    @objc private func cancelTapped() { finish(.cancelled) }

    @objc private func torchTapped() {
        guard let device = device, device.hasTorch, (try? device.lockForConfiguration()) != nil else { return }
        device.torchMode = device.torchMode == .on ? .off : .on
        device.unlockForConfiguration()
        torchButton.setImage(UIImage(systemName: device.torchMode == .on ? "bolt.fill" : "bolt.slash.fill"), for: .normal)
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard !finished,
              let code = metadataObjects.lazy
                .compactMap({ $0 as? AVMetadataMachineReadableCodeObject })
                .first(where: { !($0.stringValue ?? "").isEmpty }),
              let value = code.stringValue else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        finish(.code(value, code.type))
    }

    /// Single exit: stops the camera, reports once, dismisses.
    private func finish(_ outcome: Outcome) {
        guard !finished else { return }
        finished = true
        sessionQueue.async { [session] in
            if session.isRunning { session.stopRunning() }
        }
        onFinish(outcome)
        if presentingViewController != nil { dismiss(animated: true) }
    }
}
