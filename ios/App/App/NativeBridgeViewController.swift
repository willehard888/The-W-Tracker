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

        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 60

        webView.load(request)
    }
}