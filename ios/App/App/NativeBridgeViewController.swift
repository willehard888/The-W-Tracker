import UIKit
import Capacitor

class NativeBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        forceFreshRemoteLoad()
    }

    private func forceFreshRemoteLoad() {
        guard let webView = webView,
              let bridge = bridge else {
            return
        }

        let url = bridge.config.appStartServerURL
        guard url.isFileURL == false else {
            return
        }

        var freshURL = url
        if var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            var items = components.queryItems ?? []
            items.removeAll(where: { $0.name == "native_cb" })
            items.append(URLQueryItem(name: "native_cb", value: String(Int(Date().timeIntervalSince1970))))
            components.queryItems = items
            freshURL = components.url ?? url
        }

        var request = URLRequest(url: freshURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 60

        webView.load(request)
    }
}