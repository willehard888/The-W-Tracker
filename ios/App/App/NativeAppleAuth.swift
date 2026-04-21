import Foundation
import AuthenticationServices
import CryptoKit
import Capacitor

/// Native Sign in with Apple bridge.
///
/// This plugin exposes a single `signIn` method that the web layer can call
/// through `registerPlugin<NativeAppleAuthPlugin>("NativeAppleAuth")`.
///
/// Flow:
/// 1. Generate a cryptographically random nonce and pass its SHA256 hash to
///    Apple. The plain nonce is returned to JS so it can be forwarded to
///    Supabase's `signInWithIdToken` for replay protection.
/// 2. Request the user's full name + email scopes ONLY on first sign-in
///    (Apple only returns them once). The `hideEmail` flag controls whether
///    the user is given the option to hide their email — Apple shows the
///    "Hide My Email" toggle automatically when `email` is in `requestedScopes`.
/// 3. On success, the identity token (a signed JWT) is returned to JS, which
///    exchanges it with Supabase. Supabase verifies the JWT signature, the
///    `aud` (must equal the bundle id / Services ID configured in Apple), the
///    `iss` (`https://appleid.apple.com`), and `exp`.
@objc(NativeAppleAuth)
public class NativeAppleAuth: CAPPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var pendingCall: CAPPluginCall?
    private var currentNonce: String?

    @objc func signIn(_ call: CAPPluginCall) {
        let scopesArg = call.getArray("scopes", String.self) ?? ["fullName", "email"]
        let nonce = randomNonceString()
        currentNonce = nonce
        pendingCall = call

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = scopesArg.compactMap { mapScope($0) }
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    // MARK: - ASAuthorizationControllerDelegate

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pendingCall else { return }
        defer {
            pendingCall = nil
            currentNonce = nil
        }

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Invalid Apple credential")
            return
        }

        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            call.reject("Apple did not return an identity token")
            return
        }

        var authorizationCode: String? = nil
        if let codeData = credential.authorizationCode,
           let codeString = String(data: codeData, encoding: .utf8) {
            authorizationCode = codeString
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user,
            "nonce": currentNonce ?? NSNull()
        ]

        if let authorizationCode {
            result["authorizationCode"] = authorizationCode
        }
        if let email = credential.email {
            result["email"] = email
        }
        if let givenName = credential.fullName?.givenName {
            result["givenName"] = givenName
        }
        if let familyName = credential.fullName?.familyName {
            result["familyName"] = familyName
        }
        // realUserStatus: 0 = unsupported, 1 = unknown, 2 = likely real
        result["realUserStatus"] = credential.realUserStatus.rawValue

        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        defer {
            pendingCall = nil
            currentNonce = nil
        }

        guard let call = pendingCall else { return }

        if let asError = error as? ASAuthorizationError {
            switch asError.code {
            case .canceled:
                // User tapped Cancel on the native sheet — silent UX.
                call.reject("APPLE_CANCELLED")
                return
            case .failed:
                call.reject("Sign in with Apple failed. Please try again.")
                return
            case .invalidResponse:
                call.reject("Invalid response from Apple. Please try again.")
                return
            case .notHandled:
                call.reject("Sign in with Apple couldn't complete. Try again.")
                return
            case .notInteractive:
                call.reject("Sign in with Apple couldn't show. Try again.")
                return
            case .unknown:
                // Most common cause: missing 'Sign In with Apple' capability /
                // entitlement, or device not signed in to iCloud.
                call.reject("Sign in with Apple is not available. Make sure you're signed in to iCloud, then try again.")
                return
            @unknown default:
                call.reject("Sign in with Apple failed: \(asError.localizedDescription)")
                return
            }
        }

        call.reject("Sign in with Apple failed: \(error.localizedDescription)")
    }

    // MARK: - Presentation context

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
           let window = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first {
            return window
        }
        return ASPresentationAnchor()
    }

    // MARK: - Helpers

    private func mapScope(_ raw: String) -> ASAuthorization.Scope? {
        switch raw.lowercased() {
        case "email":
            return .email
        case "fullname", "name":
            return .fullName
        default:
            return nil
        }
    }

    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length
        while remainingLength > 0 {
            let randoms: [UInt8] = (0..<16).map { _ in
                var random: UInt8 = 0
                let status = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                if status != errSecSuccess {
                    fatalError("Unable to generate nonce. SecRandomCopyBytes failed with \(status)")
                }
                return random
            }
            for random in randoms where remainingLength > 0 {
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }
        return result
    }

    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashed = SHA256.hash(data: inputData)
        return hashed.map { String(format: "%02x", $0) }.joined()
    }
}
