import Foundation
import UniformTypeIdentifiers

func getFileExtension(from fileName: String) -> String {
    return URL(fileURLWithPath: fileName).pathExtension
}

func getFileName(from filePath: String) -> String {
    return URL(fileURLWithPath: filePath).deletingPathExtension().lastPathComponent
}

func getMimeType(ext: String) -> String {
    switch ext.lowercased() {
    case "html":
        return "text/html"
    case "css":
        return "text/css"
    case "js":
        return "application/javascript"
    case "jpg", "jpeg":
        return "image/jpeg"
    case "png":
        return "image/png"
    case "webp":
        return "image/webp"
    case "gif":
        return "image/gif"
    case "svg":
        return "image/svg+xml"
    case "ico":
        return "image/x-icon"
    case "bmp":
        return "image/bmp"
    case "tiff", "tif":
        return "image/tiff"
    case "mp4":
        return "video/mp4"
    case "webm":
        return "video/webm"
    case "mov":
        return "video/quicktime"
    case "wasm":
        return "application/wasm"
    default:
        return "application/octet-stream"
    }
}

func toJSONObject<T: Encodable>(_ object: T) -> Any? {
    do {
        let data = try JSONEncoder().encode(object)
        let jsonObject = try JSONSerialization.jsonObject(with: data, options: [])
        return jsonObject
    } catch {
        return nil
    }
}


extension URL {
    func mimeType() -> String {
        let pathExtension = self.pathExtension
        if let uti = UTType(filenameExtension: pathExtension)?.identifier,
           let mimeType = UTType(uti)?.preferredMIMEType {
            return mimeType
        }
        return "application/octet-stream"
    }
}
