package com.diff.beeconvert;

import static fi.iki.elonen.NanoHTTPD.getMimeTypeForFile;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.URLConnection;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

public class Utils {
    public static void log(Object... o) {

        String[] mss = new String[o.length];
        for (int i = 0; i < o.length; i++) {
            mss[i] = o[i] == null ? "null" : o[i].toString();
        }

        String message = String.join(" ", mss);

        String fullClassName = Thread.currentThread().getStackTrace()[3].getClassName();
        String className = fullClassName.substring(fullClassName.lastIndexOf(".") + 1);
        String methodName = Thread.currentThread().getStackTrace()[3].getMethodName();
        int lineNumber = Thread.currentThread().getStackTrace()[3].getLineNumber();

        Log.i("BEECONVERT", className + "." + methodName + "():" + lineNumber + " | " + message);

    }
    public static String getMimeTypeFromExtension(String extension) {
        if (extension == null) return null;
        extension = extension.toLowerCase();
        switch (extension) {
            case "mp4": return "video/mp4";
            case "3gp": return "video/3gpp";
            case "mov": return "video/quicktime";
            case "mkv": return "video/x-matroska";
            case "webm": return "video/webm";
            case "avi": return "video/x-msvideo";
            case "flv": return "video/x-flv";
            case "wmv": return "video/x-ms-wmv";
            case "mpg":
            case "mpeg": return "video/mpeg";
            case "wasm": return "application/wasm";
            default: return "application/octet-stream"; // fallback
        }
    }

    /**
     * Get mime type from file path or filename
     * @param path
     * @return
     */
    public static String getMimeTypeFromPath(String path) {
        String mimeType = getMimeTypeForFile(path);
        if (!Objects.equals(mimeType, "application/octet-stream")) {
            return mimeType;
        }
        String fileName = getFileNameFromPath(path);
        String ext = getFileExtension(fileName);
        String mType = getMimeTypeFromExtension(ext);
        return mType != null ? mType : "application/octet-stream";
    }



    public static String getFileNameFromPath(String path) {
        return Paths.get(path).getFileName().toString();
    }

    public static String getFileExtension(String fileName) {
        if (fileName == null) {
            return null;
        }
        int dotIndex = fileName.lastIndexOf('.');
        return (dotIndex == -1) ? "" : fileName.substring(dotIndex + 1);
    }

    public static String getFileNameWithoutExtension(String fileName) {
        if (fileName == null) return null;

        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex == -1) {
            return fileName;
        }
        return fileName.substring(0, dotIndex);
    }

    public static int getFreePort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            socket.setReuseAddress(true);
            return socket.getLocalPort();
        } catch (IOException e) {
            e.printStackTrace();
            return -1;
        }
    }

    public static String getDeviceIpAddress(Context context) {
        WifiManager wm = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            try {
                int ipInt = wm.getConnectionInfo().getIpAddress();
                return String.format(
                        "%d.%d.%d.%d",
                        (ipInt & 0xff),
                        (ipInt >> 8 & 0xff),
                        (ipInt >> 16 & 0xff),
                        (ipInt >> 24 & 0xff)
                );
            } catch (Exception e){
                e.printStackTrace();
            }
        }
        return null;
    }

    public static boolean isPortAvailable(int port) {
        try (ServerSocket socket = new ServerSocket(port)) {
            socket.setReuseAddress(true);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    public static int getAvailablePort() {
        List<Integer> commonPorts = Arrays.asList(8282, 8080, 8888, 9090, 3000);

        for (int port : commonPorts) {
            if (isPortAvailable(port)) {
                return port;
            }
        }

        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException e) {
            e.printStackTrace();
            return -1;
        }
    }
}
