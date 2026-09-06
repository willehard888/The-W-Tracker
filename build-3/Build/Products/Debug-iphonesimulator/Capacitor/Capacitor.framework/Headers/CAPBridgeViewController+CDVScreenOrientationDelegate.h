// CDVScreenOrientationDelegate inline-protocol injected by ci_pre_xcodebuild.sh
// Avoids reliance on FRAMEWORK_SEARCH_PATHS for module resolution at scan time.
#import <UIKit/UIKit.h>
#if __has_include(<Cordova/CDVScreenOrientationDelegate.h>)
  #import <Cordova/CDVScreenOrientationDelegate.h>
#else
@protocol CDVScreenOrientationDelegate <NSObject>
- (BOOL)shouldAutorotate;
- (UIInterfaceOrientationMask)supportedInterfaceOrientations;
@end
#endif

#import <Capacitor/Capacitor-Swift.h>

@interface CAPBridgeViewController (CDVScreenOrientationDelegate) <CDVScreenOrientationDelegate>

@end

