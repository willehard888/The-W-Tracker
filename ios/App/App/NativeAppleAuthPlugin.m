#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Register the Swift NativeAppleAuth class with the Capacitor bridge so it
// can be invoked from JavaScript via `registerPlugin("NativeAppleAuth")`.
CAP_PLUGIN(NativeAppleAuth, "NativeAppleAuth",
           CAP_PLUGIN_METHOD(signIn, CAPPluginReturnPromise);
)
