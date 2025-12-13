import Photos
import UIKit

class AssetsManager {
    
    let dir = URL(fileURLWithPath: NSTemporaryDirectory())
    
    func requestPermission(completion: @escaping (PHAuthorizationStatus) -> Void) {
        let status = PHPhotoLibrary.authorizationStatus()
        if status == .authorized {
            completion(status)
        } else if status == .notDetermined {
            PHPhotoLibrary.requestAuthorization { newStatus in
                completion(newStatus)
            }
        }
    }
    
    func createAlbumIfNeeded(albumName: String, completion: @escaping (PHAssetCollection?) -> Void) {
        if let collection = fetchAssetCollection(for: albumName) {
            completion(collection)
            return
        }
        
        PHPhotoLibrary.shared().performChanges({
            PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: albumName)
        }) { success, error in
            if success {
                let collection = self.fetchAssetCollection(for: albumName)
                completion(collection)
            } else {
                completion(nil)
            }
        }
    }


    func fetchAssetCollection(for albumName: String) -> PHAssetCollection? {
        let fetchOptions = PHFetchOptions()
        fetchOptions.predicate = NSPredicate(format: "title = %@", albumName)
        let collection = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: fetchOptions)
        return collection.firstObject
    }

}

