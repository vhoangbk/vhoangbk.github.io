import UIKit
import Photos
import WebKit
import GoogleMobileAds

class ViewController: UIViewController, BannerViewDelegate{
    
    let assetsManager: AssetsManager = .init()    
    var webView: WKWebView!

    @IBOutlet weak var webContainer: UIView!
    var bannerView: BannerView!
    var interstitial: InterstitialAd?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        assetsManager.requestPermission { status in
            if status == .authorized {
                self.assetsManager.createAlbumIfNeeded(albumName: "BeeConvert", completion: { _ in })
            }
        }
        
        let contentController = WKUserContentController()
        contentController.add(self, name: "BeeBridge")
        let config = WKWebViewConfiguration()
        let webpagePrefs = WKWebpagePreferences()
        webpagePrefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = webpagePrefs
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        config.userContentController = contentController

        bannerView = BannerView(adSize: currentOrientationAnchoredAdaptiveBanner(width: UIScreen.main.bounds.width))
        bannerView.adUnitID = "ca-app-pub-3631342752645707/7079745403"
        bannerView.rootViewController = self
        bannerView.delegate = self
        self.webContainer.addSubview(bannerView)
        NSLayoutConstraint.activate([
            bannerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            bannerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            bannerView.widthAnchor.constraint(equalToConstant: UIScreen.main.bounds.width),
            bannerView.heightAnchor.constraint(equalToConstant: bannerView.adSize.size.height)
        ])
        
        webView = WKWebView(frame: CGRect(x: 0, y: bannerView.adSize.size.height, width: webContainer.bounds.size.width, height: webContainer.bounds.size.height - bannerView.adSize.size.height), configuration: config)
        self.webContainer.addSubview(webView)
        webView.scrollView.bounces = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: webView.bottomAnchor),
            webView.bottomAnchor.constraint(equalTo: webContainer.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: webContainer.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: webContainer.trailingAnchor),
        ])
        
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        webView.evaluateJavaScript("navigator.userAgent") { (result, error) in
            if let ua = result as? String {
                self.webView.customUserAgent = ua + " beeconvertapp"
            }
        }
        self.webView.load(URLRequest(url: URL(string: "http://localhost:\(WebServerManager.shared.port)/m-index.html")!))
        
        MobileAds.shared.start()
        bannerView.load(Request())
        
        Task {
            await self.loadInterstitial()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.sentToJS(event: "PurchaseStatus", data: "true")
        }
        
    }
    
    func showInterstital() {
        if let ad = self.interstitial {
          ad.present(from: self)
        } else {
          print("Ad wasn't ready")
          sentToJS(event: "adDismissed", data: "");
        }
    }
    
    func loadInterstitial() async {
        do {
          interstitial = try await InterstitialAd.load(
            with: "ca-app-pub-3631342752645707/8697462291", request: Request())
          interstitial?.fullScreenContentDelegate = self
        } catch {
          print("Failed to load interstitial ad with error: \(error.localizedDescription)")
        }
      }
    
    func bannerViewDidReceiveAd(_ bannerView: BannerView) {
        print(#function)
    }
    
    func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
        print(#function + ": " + error.localizedDescription)
    }
    
    func bannerViewDidRecordClick(_ bannerView: BannerView) {
        print(#function)
    }
    
    func bannerViewDidRecordImpression(_ bannerView: BannerView) {
        print(#function)
    }
    
    func bannerViewWillPresentScreen(_ bannerView: BannerView) {
        print(#function)
    }
    
    func bannerViewWillDismissScreen(_ bannerView: BannerView) {
        print(#function)
    }
    
    func bannerViewDidDismissScreen(_ bannerView: BannerView) {
        print(#function)
    }
    
    override func viewDidLayoutSubviews() {
        self.webView.frame = CGRect(x: 0, y: bannerView.adSize.size.height, width: webContainer.bounds.size.width, height: webContainer.bounds.size.height - bannerView.adSize.size.height);
    }
    
    func sentToJS(event: String, data: String) {
        webView.evaluateJavaScript("fromIOS('\(event)', '\(data)');") { result, error in
            if let error = error {
                print("JS error: \(error)")
            } else {
                print("Result: \(String(describing: result))")
            }
        }
    }

}


extension ViewController: FullScreenContentDelegate{
    func adDidRecordImpression(_ ad: FullScreenPresentingAd) {
        print("\(#function) called")
      }
    
    func adDidRecordClick(_ ad: FullScreenPresentingAd) {
        print("\(#function) called")
    }
    
    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("\(#function) called with error: \(error.localizedDescription)")
        sentToJS(event: "adShowFailed", data: "");
    }
    
    func adWillPresentFullScreenContent(_ ad: FullScreenPresentingAd) {
        print("\(#function) called")
    }
    
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        Task {
            await self.loadInterstitial()
        }
        sentToJS(event: "adDismissed", data: "");
    }
}


extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "BeeBridge" {
            if let body = message.body as? [String: Any], let action = body["action"] as? String {
                if (action == "showAds") {
                    showInterstital()
                } else if (action == "shareVideo") {
                    let id = body["id"] as? String ?? ""
                    shareVideo(with: id)
                }
            }
        }
    }
    
}

extension UIViewController {
    
    func shareVideo(with localIdentifier: String, sourceView: UIView? = nil) {
        Task {
            do {
                let videoURL = try await fetchVideoURL(from: localIdentifier)
                await MainActor.run {
                    self.presentShareSheet(fileURL: videoURL, sourceView: sourceView)
                }
            } catch {
                print(error.localizedDescription)
            }
        }
    }

    private func fetchVideoURL(from localIdentifier: String) async throws -> URL {
        let assets = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
        guard let asset = assets.firstObject else {
            throw NSError(domain: "ShareVideo", code: 404, userInfo: [NSLocalizedDescriptionKey: "Not found asset with localIdentifier \(localIdentifier)"])
        }

        return try await withCheckedThrowingContinuation { continuation in
            let options = PHVideoRequestOptions()
            options.version = .current
            options.deliveryMode = .automatic

            PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, info in
                if let urlAsset = avAsset as? AVURLAsset {
                    continuation.resume(returning: urlAsset.url)
                } else if let avAsset = avAsset {
                    let exportURL = FileManager.default.temporaryDirectory.appendingPathComponent("video-\(UUID().uuidString).mov")
                    guard let exporter = AVAssetExportSession(asset: avAsset, presetName: AVAssetExportPresetHighestQuality) else {
                        continuation.resume(throwing: NSError(domain: "ShareVideo", code: 500, userInfo: [NSLocalizedDescriptionKey: "Không thể khởi tạo AVAssetExportSession"]))
                        return
                    }
                    exporter.outputURL = exportURL
                    exporter.outputFileType = .mov
                    exporter.exportAsynchronously {
                        if exporter.status == .completed {
                            continuation.resume(returning: exportURL)
                        } else {
                            continuation.resume(throwing: exporter.error ?? NSError(domain: "ShareVideo", code: 501, userInfo: [NSLocalizedDescriptionKey: "Export thất bại"]))
                        }
                    }
                } else {
                    continuation.resume(throwing: NSError(domain: "ShareVideo", code: 502, userInfo: [NSLocalizedDescriptionKey: "Không thể lấy AVAsset"]))
                }
            }
        }
    }

    private func presentShareSheet(fileURL: URL, sourceView: UIView?) {
        let activityVC = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)

        if let pop = activityVC.popoverPresentationController {
            pop.sourceView = sourceView ?? view
            pop.sourceRect = sourceView?.bounds ?? CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }

        present(activityVC, animated: true)
    }
}
