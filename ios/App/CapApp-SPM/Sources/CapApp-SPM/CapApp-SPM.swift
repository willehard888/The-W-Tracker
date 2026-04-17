import Foundation
import Capacitor
import AuthenticationServices
import CryptoKit
import Security

@objc(NativeAppleAuthPlugin)
public class NativeAppleAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "NativeAppleAuth"
    public let jsName = "NativeAppleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var signInCall: CAPPluginCall?
    private var currentNonce: String?

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.signInCall == nil else {
                call.reject("Apple sign-in is already in progress")
                return
            }

            guard #available(iOS 13.0, *) else {
                call.reject("Apple sign-in is not supported on this device")
                return
            }

            self.signInCall = call
            let nonce = Self.randomNonceString()
            self.currentNonce = nonce

            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(nonce)

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = signInCall else { return }
        defer {
            signInCall = nil
            currentNonce = nil
        }

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Apple sign-in failed")
            return
        }

        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            call.reject("Apple sign-in failed")
            return
        }

            let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }

        var payload: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user
        ]

        if let authorizationCode {
            payload["authorizationCode"] = authorizationCode
        }
        if let email = credential.email {
            payload["email"] = email
        }
        if let givenName = credential.fullName?.givenName {
            payload["givenName"] = givenName
        }
        if let familyName = credential.fullName?.familyName {
            payload["familyName"] = familyName
        }
        if let currentNonce {
            payload["nonce"] = currentNonce
        }

        call.resolve(payload)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = signInCall else { return }
        defer {
            signInCall = nil
            currentNonce = nil
        }

        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain,
           nsError.code == ASAuthorizationError.canceled.rawValue {
            call.reject("user canceled")
            return
        }

        call.reject(error.localizedDescription)
    }

    private static func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            var randoms: [UInt8] = Array(repeating: 0, count: 16)
            let errorCode = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            if errorCode != errSecSuccess {
                fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
            }

            randoms.forEach { random in
                if remainingLength == 0 {
                    return
                }

                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }

        return result
    }

    private static func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashed = SHA256.hash(data: inputData)
        return hashed.compactMap { String(format: "%02x", $0) }.joined()
    }
}

public let isCapacitorApp = true
