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

    excludeWalletFilesFromBackup()
    NotificationCenter.default.addObserver(
      self, selector: #selector(captureChanged),
      name: UIScreen.capturedDidChangeNotification, object: nil)
    captureChanged()
  }

  // Self-audit D2: the wallet engine keeps its database and caches in
  // Documents and creates new files there while it runs. Excluding the
  // whole folder keeps all of them, present and future, out of iCloud and
  // computer backups. Zecky keeps nothing else in Documents.
  private func excludeWalletFilesFromBackup() {
    guard var documents = FileManager.default.urls(
      for: .documentDirectory, in: .userDomainMask).first
    else { return }
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try? documents.setResourceValues(values)
  }

  // Self-audit K2: while the screen is recorded or mirrored (AirPlay, a
  // cable), Zecky hides behind the lock, so the 24 words and balances never
  // end up in a recording or on another screen.
  //
  // Re-check R9: both covers live in their own window above everything
  // (sheets, alerts), marked modal for VoiceOver, so nothing behind them
  // can be read out, tapped or opened on top of them.
  private var captureWindow: UIWindow?
  private var privacyWindow: UIWindow?

  @objc private func captureChanged() {
    DispatchQueue.main.async { [weak self] in
      guard let self, let window = self.window else { return }
      let captured = window.windowScene?.screen.isCaptured ?? false
      if captured, self.captureWindow == nil {
        window.endEditing(true)
        self.captureWindow = self.coverWindow(
          caption: "Hidden while the screen is recorded or mirrored.")
      } else if !captured {
        self.captureWindow?.isHidden = true
        self.captureWindow = nil
      }
    }
  }

  /// A window over everything, showing the lock.
  private func coverWindow(caption: String?) -> UIWindow? {
    guard let scene = window?.windowScene else { return nil }
    let cover = UIWindow(windowScene: scene)
    cover.windowLevel = .alert + 1
    let controller = UIViewController()
    let view = coverView(bounds: scene.coordinateSpace.bounds, caption: caption)
    view.accessibilityViewIsModal = true
    view.isAccessibilityElement = true
    view.accessibilityLabel = caption ?? "Zecky Lock it"
    controller.view = view
    cover.rootViewController = controller
    cover.isHidden = false
    return cover
  }

  private func coverView(bounds: CGRect, caption: String?) -> UIView {
    let cover = UIView(frame: bounds)
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    cover.backgroundColor = UIColor(red: 0.078, green: 0.086, blue: 0.110, alpha: 1)
    cover.addSubview(privacyMark(in: cover.bounds, caption: caption))
    return cover
  }

  // Privacy cover: iOS photographs the app for the app switcher when it
  // leaves the foreground. Covering everything first keeps balances,
  // addresses and open sheets out of that picture.
  func sceneWillResignActive(_ scene: UIScene) {
    guard privacyWindow == nil else { return }
    privacyWindow = coverWindow(caption: nil)
  }

  /// The closed Zecky lock with "ZECKY Lock it" under it, centred: what the
  /// app switcher shows instead of the app.
  private func privacyMark(in bounds: CGRect, caption: String?) -> UIView {
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

    var parts: [UIView] = [lock, wordmark]
    if let caption {
      let note = UILabel()
      note.text = caption
      note.font = UIFont(name: "Inter-Regular", size: 13) ?? .systemFont(ofSize: 13)
      note.textColor = UIColor(white: 0.62, alpha: 1)
      note.textAlignment = .center
      note.numberOfLines = 0
      note.preferredMaxLayoutWidth = 260
      parts.append(note)
    }
    let stack = UIStackView(arrangedSubviews: parts)
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
    privacyWindow?.isHidden = true
    privacyWindow = nil
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
