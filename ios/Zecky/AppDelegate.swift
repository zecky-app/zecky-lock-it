import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The window is created in SceneDelegate: iOS 27 refuses to launch apps
    // that don't use the UIScene lifecycle.
    return true
  }

  // Only Apple's own keyboard may be used inside Zecky. A keyboard from
  // another app could record a recovery phrase or app code as it is typed.
  func application(
    _ application: UIApplication,
    shouldAllowExtensionPointIdentifier extensionPointIdentifier: UIApplication.ExtensionPointIdentifier
  ) -> Bool {
    return extensionPointIdentifier != .keyboard
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    factory.startReactNative(
      withModuleName: "Zecky",
      in: window,
      launchOptions: nil
    )
  }

  // Privacy cover: iOS photographs the app for the app switcher when it
  // leaves the foreground. Covering the window first keeps balances,
  // addresses and open sheets out of that picture.
  private let privacyCoverTag = 947_101

  func sceneWillResignActive(_ scene: UIScene) {
    guard let window = window, window.viewWithTag(privacyCoverTag) == nil else { return }
    let cover = UIView(frame: window.bounds)
    cover.tag = privacyCoverTag
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    cover.backgroundColor = UIColor(red: 0.078, green: 0.086, blue: 0.110, alpha: 1)
    window.addSubview(cover)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    window?.viewWithTag(privacyCoverTag)?.removeFromSuperview()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
