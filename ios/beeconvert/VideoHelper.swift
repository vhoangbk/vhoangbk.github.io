import Photos
import UIKit
import AVFoundation

struct VideoInfo: Codable {
    let id: String
    let title: String
    let mimeType: String
    let displayName: String
    let duration: Double
    let size: Int64
    let dateAdded: TimeInterval?
    let width: Int
    let height: Int
    let thumb: String
}

func getVideoThumbnailBase64(from asset: PHAsset,
                             at time: CMTime = CMTime(seconds: 0.5, preferredTimescale: 600),
                             maxSize: CGSize = CGSize(width: 300, height: 300),
                             completion: @escaping (String?) -> Void) {
    let options = PHVideoRequestOptions()
    options.deliveryMode = .highQualityFormat
    options.isNetworkAccessAllowed = true
    
    PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
        guard let urlAsset = avAsset as? AVURLAsset else {
            completion(nil)
            return
        }
        
        let imageGenerator = AVAssetImageGenerator(asset: urlAsset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.maximumSize = maxSize
        
        do {
            let cgImage = try imageGenerator.copyCGImage(at: time, actualTime: nil)
            let image = UIImage(cgImage: cgImage)
            
            guard let jpegData = image.jpegData(compressionQuality: 0.8) else {
                completion(nil)
                return
            }
            
            let base64String = jpegData.base64EncodedString()
            completion(base64String)
        } catch {
            completion(nil)
        }
    }
}

func fetchVideosFromAlbum(albumName: String, pageSize: Int = 10, pageNumber: Int = 0, completion: @escaping ([VideoInfo]) -> Void) {
    var videoAssets: [PHAsset] = []
    
    let fetchOptions = PHFetchOptions()
    fetchOptions.predicate = NSPredicate(format: "title = %@", albumName)
    let collections = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: fetchOptions)
    
    if let collection = collections.firstObject {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.video.rawValue)
        options.sortDescriptors = [NSSortDescriptor(key: "modificationDate", ascending: false)]
        let assets = PHAsset.fetchAssets(in: collection, options: options)
        if assets.count == 0 {
            DispatchQueue.main.async { completion([]) }
            return
        }
        assets.enumerateObjects { asset, _, _ in
            if asset.mediaType == .video {
                videoAssets.append(asset)
            }
        }
    }
    

    // Pagination: compute slice for requested page
    let startIndex = pageNumber * pageSize
    guard startIndex < videoAssets.count else {
        DispatchQueue.main.async { completion([]) }
        return
    }
    let endIndex = min(startIndex + pageSize, videoAssets.count)
    let pageAssets = Array(videoAssets[startIndex..<endIndex])
    
    var results: [VideoInfo] = []
    let group = DispatchGroup()
    
    for asset in pageAssets {
        group.enter()
        let resources = PHAssetResource.assetResources(for: asset)
        let fileSize = resources.first?.value(forKey: "fileSize") as? Int64 ?? 0
        let title = resources.first?.originalFilename ?? ""
        let width = Int(asset.pixelWidth)
        let height = Int(asset.pixelHeight)
        let fileName = getFileName(from: title)
        let ext = getFileExtension(from: title)
        let mimetype = getMimeType(ext: ext)
        let duration = round(asset.duration)
        
        getVideoThumbnailBase64(from: asset) { imageData in
            let info = VideoInfo(
                id: asset.localIdentifier,
                title: fileName,
                mimeType: mimetype,
                displayName: title,
                duration: duration,
                size: fileSize,
                dateAdded: asset.modificationDate?.timeIntervalSince1970,
                width: width,
                height: height,
                thumb: imageData ?? ""
            )
            
            results.append(info)
            group.leave()
        }
    }
    
    group.notify(queue: .main) {
        completion(results)
    }
}

