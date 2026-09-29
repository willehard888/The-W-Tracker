import UIKit
import WebKit
import ObjectiveC

/// Takes the form accessory bar (previous / next / Done) off the keyboard.
///
/// WKWebView attaches that bar to every focused web text field. It was hidden
/// for as long as `@capacitor/keyboard` was installed — its `hideFormAccessoryBar`
/// did exactly this — and came back the day that plugin was dropped for its
/// Objective-C build race on Xcode 26.5 (859cf7e5). On iOS 26 the bar is
/// Liquid Glass: a floating capsule that refracts whatever the page paints
/// beneath it, which is how a member saw the Coach page's "Ask your coach"
/// button mirrored under the chat input.
///
/// The mechanism is the plugin's, in Swift: the content view WebKit puts in the
/// scroll view answers `inputAccessoryView`; a runtime subclass of it answers
/// nil, and the instance is moved onto that subclass. No pod, no ObjC file,
/// nothing for `cap copy` to regenerate.
enum KeyboardAccessory {
    private static var patchedClasses: [String: AnyClass] = [:]

    static func hide(in webView: WKWebView) {
        guard let content = webView.scrollView.subviews.first(where: {
            NSStringFromClass(type(of: $0)).hasPrefix("WKContent")
        }) else { return }
        let original: AnyClass = type(of: content)
        let name = NSStringFromClass(original) + "_NoAccessory"
        if let already = patchedClasses[name] {
            object_setClass(content, already)
            return
        }
        guard let patched = objc_allocateClassPair(original, name, 0) else { return }
        // -inputAccessoryView returning nil, typed as the original's getter.
        let selector = #selector(getter: UIResponder.inputAccessoryView)
        guard let method = class_getInstanceMethod(original, selector) else { return }
        let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        let imp = imp_implementationWithBlock(block)
        class_addMethod(patched, selector, imp, method_getTypeEncoding(method))
        objc_registerClassPair(patched)
        patchedClasses[name] = patched
        object_setClass(content, patched)
    }
}
