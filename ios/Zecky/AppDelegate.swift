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
    cover.addSubview(privacyMark(in: cover.bounds))
    window.addSubview(cover)
  }

  /// The closed Zecky lock with "ZECKY Lock it" under it, centred: what the
  /// app switcher shows instead of the app.
  private func privacyMark(in bounds: CGRect) -> UIView {
    let lock = UIImageView(image: UIImage(named: "CoverLock"))
    lock.contentMode = .scaleAspectFit
    lock.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      lock.widthAnchor.constraint(equalToConstant: 132),
      lock.heightAnchor.constraint(equalToConstant: 150),
    ])

    let gold = UIColor(red: 0.831, green: 0.651, blue: 0.341, alpha: 1)
    let brand = UILabel()
    brand.attributedText = NSAttributedString(
      string: "ZECKY",
      attributes: [
        .font: UIFont(name: "Inter-SemiBold", size: 15) ?? .systemFont(ofSize: 15, weight: .semibold),
        .kern: 6,
        .foregroundColor: gold,
      ])
    let product = UILabel()
    product.text = "Lock it"
    product.font = UIFont(name: "Newsreader-Regular", size: 18) ?? .systemFont(ofSize: 18)
    product.textColor = UIColor(white: 0.62, alpha: 1)

    let wordmark = UIStackView(arrangedSubviews: [brand, product])
    wordmark.axis = .horizontal
    wordmark.alignment = .lastBaseline
    wordmark.spacing = 6

    let stack = UIStackView(arrangedSubviews: [lock, wordmark])
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 22
    stack.sizeToFit()
    stack.layoutIfNeeded()
    let size = stack.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
    stack.frame = CGRect(
      x: (bounds.width - size.width) / 2,
      y: (bounds.height - size.height) / 2,
      width: size.width,
      height: size.height)
    stack.autoresizingMask = [
      .flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin, .flexibleBottomMargin,
    ]
    return stack
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
