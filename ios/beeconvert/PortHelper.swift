import Foundation
import Network

func getFreePort(preferredPorts: [UInt16] = [8282, 8080, 8000, 3000, 5000, 8888]) -> UInt16? {
    for port in preferredPorts {
        if isPortAvailable(port: port) {
            return port
        }
    }
    if let autoPort = getSystemFreePort() {
        return autoPort
    }
    
    return nil
}

private func isPortAvailable(port: UInt16) -> Bool {
    let socketFD = socket(AF_INET, SOCK_STREAM, 0)
    if socketFD == -1 { return false }
    
    var addr = sockaddr_in(
        sin_len: UInt8(MemoryLayout<sockaddr_in>.size),
        sin_family: sa_family_t(AF_INET),
        sin_port: port.bigEndian,
        sin_addr: in_addr(s_addr: inet_addr("127.0.0.1")),
        sin_zero: (0,0,0,0,0,0,0,0)
    )
    
    let bindResult = withUnsafePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            bind(socketFD, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    
    close(socketFD)
    return bindResult == 0
}

private func getSystemFreePort() -> UInt16? {
    let socketFD = socket(AF_INET, SOCK_STREAM, 0)
    if socketFD == -1 { return nil }
    
    var addr = sockaddr_in(
        sin_len: UInt8(MemoryLayout<sockaddr_in>.size),
        sin_family: sa_family_t(AF_INET),
        sin_port: 0, // 0 nghĩa là hệ thống tự chọn port
        sin_addr: in_addr(s_addr: inet_addr("127.0.0.1")),
        sin_zero: (0,0,0,0,0,0,0,0)
    )
    
    let bindResult = withUnsafePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            bind(socketFD, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    if bindResult != 0 {
        close(socketFD)
        return nil
    }
    
    var len = socklen_t(MemoryLayout<sockaddr_in>.size)
    getsockname(socketFD, withUnsafeMutablePointer(to: &addr) {
        UnsafeMutableRawPointer($0).assumingMemoryBound(to: sockaddr.self)
    }, &len)
    close(socketFD)
    
    return UInt16(bigEndian: addr.sin_port)
}
