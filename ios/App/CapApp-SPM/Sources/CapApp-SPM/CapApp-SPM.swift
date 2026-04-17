import Foundation
import Capacitor
import AuthenticationServices

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

        call.resolve([
            "identityToken": identityToken,
            "authorizationCode": authorizationCode as Any,
            "user": credential.user,
            "email": credential.email as Any,
            "givenName": credential.fullName?.givenName as Any,
            "familyName": credential.fullName?.familyName as Any,
            "nonce": currentNonce as Any
        ])
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
        let data = Data(input.utf8)
        if #available(iOS 13.0, *) {
            importCryptoKit()
            return SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
        }
        return input
    }
}

@available(iOS 13.0, *)
private func importCryptoKit() {}

@available(iOS 13.0, *)
import CryptoKit

public let isCapacitorApp = true
