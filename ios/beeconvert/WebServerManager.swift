import Foundation
import GCDWebServer
import Photos

class WebServerManager {
    
    static let shared = WebServerManager()
    let assetsManager: AssetsManager = .init()
    
    private var webServer: GCDWebServer?
    
    var port: UInt16 = 8282
    
    private init() {
        webServer = GCDWebServer()
        port = getFreePort() ?? 0
        GCDWebServer.setLogLevel(5)
    }
    
    func resolveUniqueURL(in directory: URL, filename: String) -> URL {
        let fm = FileManager.default
        var candidate = directory.appendingPathComponent(filename)
        if !fm.fileExists(atPath: candidate.path) { return candidate }

        let base = (filename as NSString).deletingPathExtension
        let ext = (filename as NSString).pathExtension
        var index = 1

        while fm.fileExists(atPath: candidate.path) {
            var name = "\(base)-\(index)"
            if !ext.isEmpty { name += ".\(ext)" }
            candidate = directory.appendingPathComponent(name)
            index += 1
        }
        return candidate
    }
    
    func uploadVideo() {
        guard let server = webServer else { return }
        server.addHandler(forMethod: "POST", path: "/upload", request: GCDWebServerMultiPartFormRequest.self) { (request, completion) in
            guard let formRequest = request as? GCDWebServerMultiPartFormRequest else {
                completion(GCDWebServerResponse(statusCode: 400))
                return
            }
            
            if let file = formRequest.firstFile(forControlName: "video") {
                let tempPath = file.temporaryPath
                let filename = file.fileName
                
                let targetDir = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
                let destURL = self.resolveUniqueURL(in: targetDir, filename: filename)
                
                PHPhotoLibrary.requestAuthorization { status in
                    guard status == .authorized || status == .limited else {
                        completion(self.responseError(message: "Photo library access not granted"))
                        return
                    }
                    do {
                        try FileManager.default.moveItem(atPath: tempPath, toPath: destURL.path)
                        PHPhotoLibrary.shared().performChanges({
                            let assetRequest = PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: destURL)
                            guard let placeholder = assetRequest?.placeholderForCreatedAsset else { return }
                            
                            if let album = self.assetsManager.fetchAssetCollection(for: "BeeConvert") {
                                if let albumChangeRequest = PHAssetCollectionChangeRequest(for: album) {
                                    let fastEnumeration = NSArray(array: [placeholder])
                                    albumChangeRequest.addAssets(fastEnumeration)
                                }
                            } else {
                                // save to photo
                                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: destURL)
                            }
                        }, completionHandler: { saved, error in
                            if error != nil {
                                completion(self.responseError(message: "Save to Photos failed"))
                            } else {
                                completion(self.responseSuccess(message: "Saved video to Photos"))
                            }
                        })
                        
                    } catch {
                        completion(self.responseError(message: "Save to Photos failed"))
                    }
                }
            } else {
                completion(GCDWebServerResponse(statusCode: 400))
            }
            
        }
    }
    
    func getSavedVideo() {
        guard let server = webServer else { return }
        
        server.addHandler(forMethod: "GET", path: "/get-saved", request: GCDWebServerMultiPartFormRequest.self) { (request, completion) in
            
            let pageSize = Int(request.query?["pageSize"] ?? "10") ?? 10
            let pageNumber = Int(request.query?["page"] ?? "0") ?? 0
            
            fetchVideosFromAlbum(albumName: "BeeConvert", pageSize: pageSize, pageNumber: pageNumber, completion: { data in
                let json = toJSONObject<VideoInfo>(data)
                let response = GCDWebServerDataResponse(jsonObject: json ?? [])
                completion(response)
            })
        }
    }
    
    func addVideoDataHandler() {
        guard let server = webServer else { return }
        
        server.addHandler(forMethod: "GET", path: "/video-data", request: GCDWebServerRequest.self, asyncProcessBlock: {(request, completion) in
            guard let localIdentifier = request.query?["id"] else {
                let response = GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "Parameter 'id' is required"])
                return completion(response)
            }
            
            let fetchOptions = PHFetchOptions()
            let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: fetchOptions)
            
            guard let asset = fetchResult.firstObject else {
                let response = GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "Video not found"])
                return completion(response)
            }
            
            guard asset.mediaType == .video else {
                let response = GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "The requested asset is not a video"])
                return completion(response)
            }
            
            let options = PHVideoRequestOptions()
            options.version = .original
            options.isNetworkAccessAllowed = true
            
            PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { (avAsset, audioMix, info) in
                guard let urlAsset = avAsset as? AVURLAsset else {
                    let response = GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "Unable to get video file path"])
                    return completion(response)
                }
                
                let fileURL = urlAsset.url
                let fileName = fileURL.lastPathComponent
                let mimeType = fileURL.mimeType()
                
                let filePath = fileURL.path
                guard FileManager.default.fileExists(atPath: filePath) else {
                    return completion(self.makeJSONResponse(["status": 500, "message": "Unable to access video file"], statusCode: 500))
                }
                
                // Check for Range header
                let rangeHeader = request.headers["Range"] ?? request.headers["range"]
                if let range = rangeHeader?.trimmingCharacters(in: .whitespacesAndNewlines), range.hasPrefix("bytes=") {
                    // Parse "bytes=start-end"
                    let byteRange = range.replacingOccurrences(of: "bytes=", with: "")
                    let parts = byteRange.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false).map { String($0) }
                    
                    let fileSize: UInt64
                    do {
                        let attrs = try FileManager.default.attributesOfItem(atPath: filePath)
                        fileSize = (attrs[.size] as? NSNumber)?.uint64Value ?? 0
                    } catch {
                        return completion(self.makeJSONResponse(["status": 500, "message": "Unable to read file size"], statusCode: 500))
                    }
                    
                    var start: UInt64 = 0
                    var end: UInt64 = fileSize > 0 ? fileSize - 1 : 0
                    
                    if parts.count == 2 {
                        if !parts[0].isEmpty, let s = UInt64(parts[0]) {
                            start = s
                        }
                        if !parts[1].isEmpty, let e = UInt64(parts[1]) {
                            end = e
                        }
                    } else if parts.count == 1 {
                        // "bytes=START-" or "-SUFFIX"
                        if range.hasPrefix("bytes=-") {
                            // suffix length
                            if let suffixLen = UInt64(parts[0]) {
                                if suffixLen >= fileSize {
                                    start = 0
                                } else {
                                    start = fileSize - suffixLen
                                }
                            }
                        } else {
                            if let s = UInt64(parts[0]) {
                                start = s
                            }
                        }
                    }
                    
                    // Validate range
                    if start >= fileSize || start > end {
                        let resp = GCDWebServerDataResponse(statusCode: 416)
                        resp.setValue("bytes */\(fileSize)", forAdditionalHeader: "Content-Range")
                        resp.setValue("bytes", forAdditionalHeader: "Accept-Ranges")
                        return completion(resp)
                    }
                    
                    let readLength = Int(end - start + 1)
                    
                    do {
                        let handle = try FileHandle(forReadingFrom: URL(fileURLWithPath: filePath))
                        defer { try? handle.close() }
                        try handle.seek(toOffset: start)
                        let data = handle.readData(ofLength: readLength)
                        
                        let dataResp = GCDWebServerDataResponse(data: data, contentType: mimeType)
                        dataResp.statusCode = 206
                        dataResp.setValue("bytes", forAdditionalHeader: "Accept-Ranges")
                        dataResp.setValue("bytes \(start)-\(end)/\(fileSize)", forAdditionalHeader: "Content-Range")
                        dataResp.setValue("\(readLength)", forAdditionalHeader: "Content-Length")
                        dataResp.setValue("inline; filename=\"\(fileName)\"", forAdditionalHeader: "Content-Disposition")
                        dataResp.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
                        dataResp.setValue("Content-Length, Content-Range, Accept-Ranges", forAdditionalHeader: "Access-Control-Expose-Headers")
                        return completion(dataResp)
                    } catch {
                        return completion(self.makeJSONResponse(["status": 500, "message": "Unable to read file for range request"], statusCode: 500))
                    }
                } else {
                    // No range requested — return file response (file response usually supports range internally, but we provide full file)
                    if let fileResponse = GCDWebServerFileResponse(file: filePath) {
                        fileResponse.contentType = mimeType
                        fileResponse.setValue("bytes", forAdditionalHeader: "Accept-Ranges")
                        fileResponse.setValue("inline; filename=\"\(fileName)\"", forAdditionalHeader: "Content-Disposition")
                        fileResponse.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
                        fileResponse.setValue("Content-Length, Content-Range, Accept-Ranges", forAdditionalHeader: "Access-Control-Expose-Headers")
                        return completion(fileResponse)
                    } else {
                        return completion(self.makeJSONResponse(["status": 500, "message": "Unable to create file response"], statusCode: 500))
                    }
                }
            }
        })
    }
    
    func addDeleteVideoHandler() {
        guard let server = webServer else { return }
        server.addHandler(forMethod: "POST",
                          path: "/delete-video",
                          request: GCDWebServerMultiPartFormRequest.self,
                          asyncProcessBlock: { (request, completion) in
            guard let form = request as? GCDWebServerMultiPartFormRequest else {
                return completion(self.responseError(errorCode: 400, message: "Invalid request"))
            }
            
            guard let idArg = form.firstArgument(forControlName: "id"),
                  let localIdentifier = idArg.string else {
                return completion(self.responseError(errorCode: 400, message: "Parameter id is required"))
            }
            
            let auth = PHPhotoLibrary.authorizationStatus()
            guard auth == .authorized || auth == .limited else {
                return completion(self.responseError(errorCode: 403, message: "Photo library access not granted"))
            }
            
            let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
            guard fetchResult.firstObject != nil else {
                return completion(self.responseError(errorCode: 404, message: "Video not found"))
            }
            
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.deleteAssets(fetchResult)
            }, completionHandler: { success, error in
                if let error = error {
                    completion(self.responseError(errorCode: 500, message: "Delete failed \(error.localizedDescription)"))
                } else if success {
                    completion(self.responseSuccess(message: "success"))
                } else {
                    completion(self.responseError(errorCode: 500, message: "Unknown error"))
                }
            })
        })
    }
    
    func responseError(errorCode: Int = 500, message: String) -> GCDWebServerDataResponse? {
        let resp = GCDWebServerDataResponse(jsonObject: ["status": errorCode, "message": message])
        resp?.statusCode = errorCode;
        resp?.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
        return resp
    }
    
    var fileURL: URL? = nil;
    
    func addUploadHandler() {
        guard let server = webServer else { return }
        server.addHandler(forMethod: "POST", path: "/upload-stream", request: GCDWebServerMultiPartFormRequest.self) { request, completion in
            guard let form = request as? GCDWebServerMultiPartFormRequest else {
                return completion(GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "Invalid request"]))
            }
            
            let filename = form.firstArgument(forControlName: "filename")?.string ?? ""
            let action = form.firstArgument(forControlName: "action")?.string ?? ""
            let filePart = form.firstFile(forControlName: "data")
            let position = Int(form.firstArgument(forControlName: "position")?.string ?? "") ?? 0
            
            print("Upload request action=\(action), filename=\(filename), position=\(position)")
            
            guard !action.isEmpty else {
                return completion(GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "missing params"]))
            }
            
            switch action.lowercased() {
                
            case "write":
                guard let filePart = filePart else {
                    return completion(GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "missing file data"]))
                }
                self.handleWriteChunk(filename: filename, filePart: filePart, position: position, completion: completion)
            case "complete":
                self.handleComplete(filename: filename, completion: completion)
            default:
                self.fileURL = nil
                completion(GCDWebServerDataResponse(jsonObject: ["status": 400, "message": "action not defined"]))
            }
        }
    }
    
    // MARK: - write file
    private func handleWriteChunk(filename: String, filePart: GCDWebServerMultiPartFile, position: Int, completion: @escaping GCDWebServerCompletionBlock) {
        let tempFileURL = URL(fileURLWithPath: filePart.temporaryPath)
        let fileManager = FileManager.default
        let targetDir = fileManager.temporaryDirectory.appendingPathComponent("beeconvert", isDirectory: true)
        try? fileManager.createDirectory(at: targetDir, withIntermediateDirectories: true)

        // Ensure we have a file URL to write to
        if fileURL == nil {
            fileURL = targetDir.appendingPathComponent(filename)
            if !fileManager.fileExists(atPath: fileURL!.path) {
                fileManager.createFile(atPath: fileURL!.path, contents: nil, attributes: nil)
            }
        }

        guard let destination = fileURL else {
            completion(makeJSONResponse(["status": 500, "message": "No destination file"]))
            return
        }

        // If this is a fresh upload starting at 0, recreate/truncate the file so old data doesn't remain
        if position == 0 {
            try? fileManager.removeItem(at: destination)
            fileManager.createFile(atPath: destination.path, contents: nil, attributes: nil)
        }

        do {
            let writeHandle = try FileHandle(forWritingTo: destination)
            let readHandle = try FileHandle(forReadingFrom: tempFileURL)
            defer {
                try? readHandle.close()
                try? writeHandle.close()
            }

            // Seek to the requested position (UInt64)
            let offset = UInt64(max(0, position))
            // Seeking beyond EOF is allowed; the file will be extended accordingly
            try? writeHandle.seek(toOffset: offset)

            let bufferSize = 8192
            while autoreleasepool(invoking: {
                let data = readHandle.readData(ofLength: bufferSize)
                if data.isEmpty { return false }
                writeHandle.write(data)
                return true
            }) {}

            // cleanup temp part
            try? fileManager.removeItem(at: tempFileURL)

            let response: [String: Any] = [
                "status": 200,
                "message": "File chunk written",
                "position": position
            ]
            completion(makeJSONResponse(response))
        } catch {
            print("Write chunk failed: \(error)")
            completion(makeJSONResponse(["status": 500, "message": "Write chunk failed"]))
        }
    }
    
    // MARK: - complete file
    private func handleComplete(filename: String, completion: @escaping GCDWebServerCompletionBlock) {
        guard let fileURL = fileURL else {
            return completion(GCDWebServerDataResponse(jsonObject: [
                "status": 500,
                "message": "No file to complete"
            ]))
        }
        
        let attr = try? FileManager.default.attributesOfItem(atPath: fileURL.path)
        let size = attr?[.size] as? Int64 ?? 0
        let ext = (filename as NSString).pathExtension
        let format = getMimeType(ext: ext)
        
        var localIdentifier: String?
        PHPhotoLibrary.shared().performChanges({
            let assetRequest = PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
            localIdentifier = assetRequest?.placeholderForCreatedAsset?.localIdentifier
            guard let placeholder = assetRequest?.placeholderForCreatedAsset else { return }
            if let album = self.assetsManager.fetchAssetCollection(for: "BeeConvert") {
                if let albumChangeRequest = PHAssetCollectionChangeRequest(for: album) {
                    let fastEnumeration = NSArray(array: [placeholder])
                    albumChangeRequest.addAssets(fastEnumeration)
                }
            } else {
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
            }
            
            let urlString = "http://localhost:\(self.port)/video-data?id=\(localIdentifier ?? "")"
            let response: [String: Any] = [
                "status": 200,
                "message": "File saved successfully.",
                "size": size,
                "format": format,
                "id": localIdentifier ?? "",
                "url": urlString
            ]
            self.fileURL = nil
            completion(self.makeJSONResponse(response))
        })
    }
    
    func responseSuccess(message: String) -> GCDWebServerDataResponse? {
        let resp = GCDWebServerDataResponse(jsonObject: ["status": 200, "message": message])
        resp?.statusCode = 200;
        resp?.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
        return resp
    }
    
    func addHeaderMultiThread(resp: GCDWebServerFileResponse) -> GCDWebServerFileResponse {
        resp.setValue("same-origin", forAdditionalHeader: "Cross-Origin-Opener-Policy")
        resp.setValue("require-corp", forAdditionalHeader: "Cross-Origin-Embedder-Policy")
        resp.setValue("cross-origin", forAdditionalHeader: "Cross-Origin-Resource-Policy")
        return resp
    }
    
    private func makeJSONResponse(_ object: Any, statusCode: Int = 200) -> GCDWebServerDataResponse {
            if let resp = GCDWebServerDataResponse(jsonObject: object) {
                resp.statusCode = statusCode
                resp.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
                resp.setValue("GET, POST, OPTIONS", forAdditionalHeader: "Access-Control-Allow-Methods")
                resp.setValue("*", forAdditionalHeader: "Access-Control-Allow-Headers")
                return resp
            } else {
                let fallback = GCDWebServerDataResponse(statusCode: 500)
                fallback.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
                return fallback
            }
        }
    
    func startServer() {
        guard let server = webServer else { return }
        
        server.addDefaultHandler(forMethod: "GET",
                                 request: GCDWebServerRequest.self,
                                 processBlock: { request in
            
            var path = request.url.path
            let ext = request.url.pathExtension.lowercased()
            let name = request.url.lastPathComponent.replacingOccurrences(of: ".\(ext)", with: "")
            //            print("request: \(path)")
            
            if (path == "/" || path == "") {
                if let filePath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "public"){
                    if let resp = GCDWebServerFileResponse(file: filePath) {
                        resp.contentType = "text/html"
                        let newResp = self.addHeaderMultiThread(resp: resp)
                        return newResp
                    }
                }
            }
            
            else {
                if let lastSlashIndex = path.lastIndex(of: "/") {
                    path = String(path[..<lastSlashIndex])
                }
                if let filePath = Bundle.main.path(forResource: name, ofType: ext, inDirectory: "public\(path)"){
                    if let resp = GCDWebServerFileResponse(file: filePath) {
                        resp.contentType = getMimeType(ext: ext)
                        resp.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
                        let newResp = self.addHeaderMultiThread(resp: resp)
                        return newResp
                    }
                }
            }
            return GCDWebServerResponse(statusCode: 400)
        })
        
        uploadVideo()
        
        getSavedVideo()
        
        addVideoDataHandler()
        
        addDeleteVideoHandler()
        
        addUploadHandler()
        
        server.addHandler(forMethod: "OPTIONS",
                          pathRegex: ".*",
                          request: GCDWebServerRequest.self) { request in
            let response = GCDWebServerResponse(statusCode: 200)
            response.setValue("*", forAdditionalHeader: "Access-Control-Allow-Origin")
            response.setValue("GET, POST, OPTIONS", forAdditionalHeader: "Access-Control-Allow-Methods")
            response.setValue("*", forAdditionalHeader: "Access-Control-Allow-Headers")
            return response
        }
        
        
        do {
            try server.start(options: [
                GCDWebServerOption_AutomaticallySuspendInBackground: false,
                GCDWebServerOption_Port: port
            ])
            print("✅ WebServer started at: \(server.serverURL?.absoluteString ?? "unknown")")
        } catch {
            print("❌ Failed to start server: \(error)")
        }
    }
    
    func stopServer() {
        if let server = webServer, server.isRunning {
            server.stop()
        }
        webServer = nil
    }
    
}
