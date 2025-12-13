package com.diff.beeconvert;

import android.app.Activity;
import android.app.RecoverableSecurityException;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.IntentSender;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.util.Size;

import com.google.gson.Gson;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import fi.iki.elonen.NanoHTTPD;

public class WebServer extends NanoHTTPD {
    private Context context;
    private static final String TAG = "WebServer";
    public static final String SAVED_FOLDER = "Movies/beeconvert";

    private final int port;
    public WebServer(int port) {
        super(port);
        this.port = port;
    }

    public void setContext(Context context) {
        this.context = context;
    }

    public Response generateResponse(Response.Status status, Object obj) {
        Gson gson = new Gson();
        String json = gson.toJson(obj);
        Response res = newFixedLengthResponse(
                status,
                "application/json",
                json
        );
        res.addHeader("Access-Control-Allow-Origin", "*");
        res.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
        return corsResponse(res);
    }

    private Response corsResponse(Response res) {
        res.addHeader("Access-Control-Allow-Origin", "*");
        res.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.addHeader("Access-Control-Allow-Headers", "*");
        return res;
    }

    private Response handleUpload(IHTTPSession session) {
        try {
            Map<String, String> files = new HashMap<>();
            session.parseBody(files);

            String tempFilePath = files.get("video");
            if (tempFilePath == null) {
                Map<String, Object> responseBody = new HashMap<>();
                responseBody.put("message", "No file part in the request");
                responseBody.put("status", Response.Status.INTERNAL_ERROR.getRequestStatus());
                return generateResponse(Response.Status.INTERNAL_ERROR, responseBody);
            }
            String originalFileName = Objects.requireNonNull(session.getParameters().get("video")).get(0);
            if (originalFileName == null || originalFileName.isEmpty()) {
                originalFileName = "converted-video.mp4";
            }
            String mimeType = Utils.getMimeTypeFromPath(originalFileName);

            File tempFile = new File(tempFilePath);
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, originalFileName);
            values.put(MediaStore.Video.Media.RELATIVE_PATH, SAVED_FOLDER);
            values.put(MediaStore.Video.Media.MIME_TYPE, mimeType);
            values.put(MediaStore.Video.Media.IS_PENDING, 1);
            Uri externalUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
            Uri fileUri = context.getContentResolver().insert(externalUri, values);

            if (fileUri != null) {
                try (OutputStream os = context.getContentResolver().openOutputStream(fileUri);
                     FileInputStream fis = new FileInputStream(tempFile)) {
                    if (os != null) {
                        byte[] buffer = new byte[4096];
                        int bytesRead;
                        while ((bytesRead = fis.read(buffer)) != -1) {
                            os.write(buffer, 0, bytesRead);
                        }
                        os.flush();
                    }
                }
                values.clear();
                values.put(MediaStore.Video.Media.IS_PENDING, 0);
                context.getContentResolver().update(fileUri, values, null, null);
                if (!tempFile.delete()) {
                    Log.w(TAG, "Could not delete temporary file: " + tempFile.getAbsolutePath());
                }
                Map<String, Object> responseBody = new HashMap<>();
                responseBody.put("message", "File saved to Movies/beeconvert folder");
                responseBody.put("status", Response.Status.OK.getRequestStatus());
                return generateResponse(Response.Status.OK, responseBody);
            } else {
                Map<String, Object> responseBody = new HashMap<>();
                responseBody.put("message", "Failed to create MediaStore entry");
                responseBody.put("status", Response.Status.INTERNAL_ERROR.getRequestStatus());
                return generateResponse(Response.Status.INTERNAL_ERROR, responseBody);
            }
        } catch (IOException | ResponseException e) {
            Log.e(TAG, "Error handling file upload", e);
            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("message", "Server error during upload");
            responseBody.put("status", Response.Status.INTERNAL_ERROR.getRequestStatus());
            return generateResponse(Response.Status.INTERNAL_ERROR, responseBody);
        }
    }

    public Bitmap getVideoThumbnail(long videoId) throws IOException {
        Uri videoUri = ContentUris.withAppendedId(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            videoId
        );
        Size size = new Size(320, 240);
        return context.getContentResolver().loadThumbnail(videoUri, size, null);
    }

    public String bitmapToBase64(Bitmap bitmap) {
        ByteArrayOutputStream stream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream);
        byte[] bytes = stream.toByteArray();
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
    }

    private Response getSavedVideo(IHTTPSession session) {
        try {
            Map<String, List<String>> allParams = session.getParameters();
            String pageSize = "10";
            String page = "0";
            String sort = "newest";
            if (allParams.containsKey("pageSize")) {
                pageSize = Objects.requireNonNull(allParams.get("pageSize")).get(0);
            }
            if (allParams.containsKey("page")) {
                page = Objects.requireNonNull(allParams.get("page")).get(0);
            }
            if (allParams.containsKey("sort")) {
                sort = Objects.requireNonNull(allParams.get("sort")).get(0);
            }

            List<VideoHelper.VideoItem> videos = VideoHelper.getSaveVideos(context.getContentResolver(), sort, Integer.parseInt(pageSize), Integer.parseInt(page));

            videos.forEach(e -> {
                try {
                    Bitmap bitmap = getVideoThumbnail(Long.parseLong(e.id));
                    e.thumb = bitmapToBase64(bitmap);
                } catch (IOException ex) {
                    Utils.log(ex.getMessage());
                }
            });

            return generateResponse(Response.Status.OK, videos);
        } catch (Exception e) {
            return responseError(e.getMessage());
        }
    }

    private Response getVideoData(IHTTPSession session) {
        try {
            Map<String, List<String>> allParams = session.getParameters();
            if (allParams.containsKey("id")) {
                String id = Objects.requireNonNull(allParams.get("id")).get(0);
                long videoId = Long.parseLong(id);
                Uri videoUri = ContentUris.withAppendedId(
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                    videoId
                );

                String mimeType = "video/mp4";
                String fileName = "video.mp4";
                long fileSize = getSize(videoId);

                String[] projection = {
                    MediaStore.Video.Media.MIME_TYPE,
                    MediaStore.Video.Media.DISPLAY_NAME
                };

                try (Cursor cursor = context.getContentResolver().query(videoUri, projection, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        String mediaStoreMimeType = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE));
                        if (mediaStoreMimeType != null && !mediaStoreMimeType.isEmpty()) {
                            mimeType = mediaStoreMimeType;
                        }

                        String displayName = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME));
                        if (displayName != null && !displayName.isEmpty()) {
                            fileName = displayName;
                        }
                    }
                }

                // Xử lý Range request
                String rangeHeader = session.getHeaders().get("range");
                
                if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                    return handleRangeRequest(videoUri, mimeType, fileName, fileSize, rangeHeader);
                } else {
                    // Không có Range header - trả về toàn bộ file
                    InputStream inputStream = context.getContentResolver().openInputStream(videoUri);
                    if (inputStream != null) {
                        Response res = newFixedLengthResponse(Response.Status.OK, mimeType, inputStream, fileSize);
                        res.addHeader("Accept-Ranges", "bytes");
                       // res.addHeader("Content-Length", String.valueOf(fileSize));
                        res.addHeader("Content-Disposition", "inline; filename=\"" + fileName + "\"");
                        res.addHeader("Access-Control-Allow-Origin", "*");
                        res.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
                        return res;
                    } else {
                        return responseError("File not found");
                    }
                }
            } else {
                return responseError("Parameter 'id' is required.");
            }
        } catch (Exception e) {
            return responseError(e.getMessage());
        }
    }

    private Response handleRangeRequest(Uri videoUri, String mimeType, String fileName, long fileSize, String rangeHeader) {
        try {
            // Parse Range header: "bytes=start-end"
            String range = rangeHeader.substring("bytes=".length());
            String[] parts = range.split("-");
            
            long rangeStart = 0;
            long rangeEnd = fileSize - 1;
            
            // Parse start
            if (parts.length > 0 && !parts[0].isEmpty()) {
                rangeStart = Long.parseLong(parts[0]);
            }
            
            // Parse end
            if (parts.length > 1 && !parts[1].isEmpty()) {
                rangeEnd = Long.parseLong(parts[1]);
            }
            
            // Validate range
            if (rangeStart > rangeEnd || rangeStart >= fileSize) {
                Response res = newFixedLengthResponse(Response.Status.RANGE_NOT_SATISFIABLE, "text/plain", "Invalid range");
                res.addHeader("Content-Range", "bytes */" + fileSize);
                res.addHeader("Access-Control-Allow-Origin", "*");
                res.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
                return res;
            }
            
            // Ensure rangeEnd doesn't exceed file size
            if (rangeEnd >= fileSize) {
                rangeEnd = fileSize - 1;
            }
            
            long contentLength = rangeEnd - rangeStart + 1;
            
            Log.d(TAG, "Range request: bytes=" + rangeStart + "-" + rangeEnd + "/" + fileSize + " (length=" + contentLength + ")");
            
            // Open input stream and skip to start position
            InputStream inputStream = context.getContentResolver().openInputStream(videoUri);
            if (inputStream == null) {
                return responseError("File not found");
            }
            
            // Skip to range start
            long skipped = 0;
            while (skipped < rangeStart) {
                long toSkip = rangeStart - skipped;
                long actualSkipped = inputStream.skip(toSkip);
                if (actualSkipped <= 0) {
                    break;
                }
                skipped += actualSkipped;
            }
            
            // Create limited input stream for the range
            InputStream limitedStream = new LimitedInputStream(inputStream, contentLength);
            
            // Return partial content response
            Response res = newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mimeType, limitedStream, contentLength);
            res.addHeader("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
            res.addHeader("Accept-Ranges", "bytes");
            res.addHeader("Content-Length", String.valueOf(contentLength));
            res.addHeader("Content-Disposition", "inline; filename=\"" + fileName + "\"");
            res.addHeader("Access-Control-Allow-Origin", "*");
            res.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
            
            return res;
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling range request", e);
            return responseError("Error processing range request: " + e.getMessage());
        }
    }

    // Helper class để giới hạn số bytes đọc từ InputStream
    private static class LimitedInputStream extends InputStream {
        private final InputStream inputStream;
        private long remaining;

        public LimitedInputStream(InputStream inputStream, long limit) {
            this.inputStream = inputStream;
            this.remaining = limit;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int result = inputStream.read();
            if (result != -1) {
                remaining--;
            }
            return result;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int toRead = (int) Math.min(len, remaining);
            int result = inputStream.read(b, off, toRead);
            if (result > 0) {
                remaining -= result;
            }
            return result;
        }

        @Override
        public void close() throws IOException {
            inputStream.close();
        }
    }

    private Response deleteVideo(IHTTPSession session) {
        try {
            session.parseBody(new HashMap<String, String>());
            Map<String, List<String>> params = session.getParameters();
            List<String> idList = params.get("id");
            if (idList == null || idList.isEmpty()) {
                return responseError("Parameter 'id' is required.");
            }
            String id = idList.get(0);
            long videoId = Long.parseLong(id);
            Uri videoUri = ContentUris.withAppendedId(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                videoId
            );
            try {
                int rowsDeleted = context.getContentResolver().delete(videoUri, null, null);
                if (rowsDeleted > 0) {
                    Map<String, Object> responseBody = new HashMap<>();
                    responseBody.put("message", "success");
                    responseBody.put("status", Response.Status.OK.getRequestStatus());
                    return generateResponse(Response.Status.OK, responseBody);
                } else {
                    return responseError("Video not found or could not be deleted.");
                }
            } catch (RecoverableSecurityException e) {
                IntentSender intentSender = e.getUserAction().getActionIntent().getIntentSender();
                if (context instanceof Activity) {
                    try {
                        ((Activity) context).startIntentSenderForResult(
                            intentSender,
                            101,
                            null,
                            0,
                            0,
                            0
                        );
                    } catch (IntentSender.SendIntentException ex) {
                        ex.printStackTrace();
                    }
                }
                Map<String, Object> responseBody = new HashMap<>();
                responseBody.put("message", "permission_required");
                responseBody.put("status", 403);
                return generateResponse(Response.Status.FORBIDDEN, responseBody);
            } catch (SecurityException e) {
                return responseError("Permission denied to delete the video.");
            }
        } catch (Exception e) {
            return responseError(e.getMessage());
        }
    }

    private long getSize(long id) {
        String[] projection = {
            MediaStore.Video.Media.SIZE,
        };
        Uri videoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id);
        try (Cursor cursor = context.getContentResolver().query(videoUri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE));
            }
        } catch (Exception e) {
            Log.e(TAG, "Could not get size for video ID: " + id, e);
        }
        return 0;
    }

    Uri fileUri = null;

    public Response uploadStream(IHTTPSession session) {
        try {
            Map<String, List<String>> allParams = session.getParameters();
            String filename = "";
            String data = "";
            String action = "";
            String position = "";

            Map<String, String> files = new HashMap<>();
            session.parseBody(files);

            if (allParams.containsKey("filename")) {
                filename = Objects.requireNonNull(allParams.get("filename")).get(0);
            }
            if (allParams.containsKey("data")) {
                data = Objects.requireNonNull(allParams.get("data")).get(0);
            }
            if (allParams.containsKey("action")) {
                action = Objects.requireNonNull(allParams.get("action")).get(0);
            }
            if (allParams.containsKey("position")) {
                position = Objects.requireNonNull(allParams.get("position")).get(0);
            }

            Log.d(TAG, "filename: " + filename + " data: " + data + " action: " + action + " position: " + position);

            if (action.isEmpty()) {
                return generateResponse(Response.Status.INTERNAL_ERROR, "missing params");
            }

            if ("write".equalsIgnoreCase(action)) {
                String tempChunkPath = files.get("data");
                Log.d(TAG,  "write file" + filename);
                String mimeType = Utils.getMimeTypeFromPath(filename);

                if (fileUri != null) {
                    Log.d(TAG, "File chunk exists, appending data: " + filename);
                    File tempFile = new File(tempChunkPath);

                    try (ParcelFileDescriptor pfd = context.getContentResolver().openFileDescriptor(fileUri, "rw");
                         FileInputStream fis = new FileInputStream(tempFile)) {

                        if (pfd != null) {
                            try (FileOutputStream fos = new FileOutputStream(pfd.getFileDescriptor())) {
                                FileChannel channel = fos.getChannel();

                                int pos = Integer.parseInt(position);
                                if (pos >= 0) {
                                    channel.position(pos);
                                } else {
                                    channel.position(channel.size());
                                }

                                // Write the chunk data
                                byte[] buffer = new byte[8192];
                                int bytesRead;
                                while ((bytesRead = fis.read(buffer)) != -1) {
                                    fos.write(buffer, 0, bytesRead);
                                }
                                fos.flush();
                            }
                        }
                    }

                    if (!tempFile.delete()) {
                        Log.w(TAG, "Could not delete temporary file: " + tempFile.getAbsolutePath());
                    }

                    Log.d(TAG, "Chunk written successfully: " + filename);
                    Map<String, Object> responseBody = new HashMap<>();
                    responseBody.put("message", "Chunk written successfully");
                    responseBody.put("status", Response.Status.OK.getRequestStatus());
                    return generateResponse(Response.Status.OK, responseBody);
                } else {
                    Log.d(TAG, "File chunk does not exist, creating new: " + filename);
                    File tempFile = new File(tempChunkPath);
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.Video.Media.RELATIVE_PATH, SAVED_FOLDER);
                    values.put(MediaStore.Video.Media.MIME_TYPE, mimeType);
                    values.put(MediaStore.Video.Media.IS_PENDING, 1);
                    Uri externalUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                    fileUri = context.getContentResolver().insert(externalUri, values);

                    if (fileUri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(fileUri);
                             FileInputStream fis = new FileInputStream(tempFile)) {
                            if (os != null) {
                                byte[] buffer = new byte[8192];
                                int bytesRead;
                                while ((bytesRead = fis.read(buffer)) != -1) {
                                    os.write(buffer, 0, bytesRead);
                                }
                                os.flush();
                            }
                        }
                        if (!tempFile.delete()) {
                            Log.w(TAG, "Could not delete temporary file: " + tempFile.getAbsolutePath());
                        }
                        Log.d(TAG, "First chunk written successfully: " + filename);
                        Map<String, Object> responseBody = new HashMap<>();
                        responseBody.put("message", "First chunk written successfully");
                        responseBody.put("status", Response.Status.OK.getRequestStatus());
                        return generateResponse(Response.Status.OK, responseBody);
                    } else {
                        Map<String, Object> responseBody = new HashMap<>();
                        responseBody.put("message", "Failed to save temp file");
                        responseBody.put("status", Response.Status.INTERNAL_ERROR.getRequestStatus());
                        return generateResponse(Response.Status.INTERNAL_ERROR, responseBody);
                    }
                }

            } else if ("complete".equalsIgnoreCase(action)) {
                Log.d(TAG,  "complete file" + filename + " uri: " + fileUri);
                if (fileUri != null) {

                    ContentValues updateValues = new ContentValues();
                    updateValues.put(MediaStore.Video.Media.IS_PENDING, 0);
                    context.getContentResolver().update(fileUri, updateValues, null, null);


                    long id = getIdFromUri(fileUri);
                    long size = getSize(id);
                    String format = Utils.getMimeTypeFromPath(filename);
                    Log.d(TAG, "File saved to Movies/beeconvert folder with filename: " + filename);
                    Map<String, Object> responseBody = new HashMap<>();
                    responseBody.put("message", "File saved to Movies/beeconvert folder.");
                    responseBody.put("status", Response.Status.OK.getRequestStatus());
                    responseBody.put("size", size);
                    responseBody.put("format", format);
                    responseBody.put("id", id);
                    responseBody.put("url",  String.format("http://localhost:%s/video-data?id=%s", port, id));
                    fileUri = null;
                    return generateResponse(Response.Status.OK, responseBody);
                } else {
                    Map<String, Object> responseBody = new HashMap<>();
                    responseBody.put("message", "Failed to save temp file");
                    responseBody.put("status", Response.Status.INTERNAL_ERROR.getRequestStatus());
                    return generateResponse(Response.Status.INTERNAL_ERROR, responseBody);
                }
            } else {
                fileUri = null;
                return generateResponse(Response.Status.INTERNAL_ERROR, "action not define");
            }
        } catch (Exception e) {
            fileUri = null;
            return generateResponse(Response.Status.INTERNAL_ERROR, e.getMessage());
        }
    }

    public long getIdFromUri(Uri uri) {
        try {
            return ContentUris.parseId(uri);
        } catch (NumberFormatException e) {
            Log.e(TAG, "Failed to parse ID from URI: " + uri, e);
            return -1;
        }
    }

    /**
     * Handles CORS preflight requests (OPTIONS method). This is crucial for browsers
     * to allow complex cross-origin requests, like those with a 'Range' header for video streaming.
     */
    private Response handleOptionsRequest() {
        // Always respond with OK for preflight requests.
        Response res = newFixedLengthResponse(Response.Status.OK, "text/plain", null, 0);

        // Define which origins, methods, and headers are allowed.
        res.addHeader("Access-Control-Allow-Origin", "*");
        res.addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.addHeader("Access-Control-Allow-Headers", "Content-Type, Range, Accept");
        res.addHeader("Access-Control-Max-Age", "86400"); // Cache preflight response for 1 day

        return res;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        Log.d(TAG, uri);
        // Handle CORS preflight requests first. This is critical.
        if (Method.OPTIONS.equals(method)) {
            return handleOptionsRequest();
        }
        Response response = null;

        try {
            if (Method.POST.equals(method) && "/upload".equals(uri)) {
                response = handleUpload(session);
            } else if (Method.GET.equals(method) && "/get-saved".equals(uri)) {
                response = getSavedVideo(session);
            } else if ( (Method.HEAD.equals(method) ||Method.GET.equals(method)) && "/video-data".equals(uri)) {
                response = getVideoData(session);
            } else if (Method.POST.equals(method) && "/delete-video".equals(uri)) {
                response = deleteVideo(session);
            } else if (Method.POST.equals(method) && "/upload-stream".equals(uri)) {
                response = uploadStream(session);
            }

            if (response != null) {
                response.addHeader("Connection", "keep-alive");
                return  response;
            }

            String assetPath = uri.startsWith("/") ? uri.substring(1) : uri;
            if (assetPath.isEmpty()) {
                assetPath = "index.html";
            }
            String mimeType = Utils.getMimeTypeFromPath(assetPath);
            
            try {
                InputStream assetStream = context.getAssets().open(assetPath);
                response = newChunkedResponse(Response.Status.OK, mimeType, assetStream);
                response.addHeader("Access-Control-Allow-Origin", "*");
            } catch (IOException e) {
                Log.w(TAG, "Asset not found: " + assetPath);
                return responseError("Asset not found: " + assetPath);
            }
        } catch (Exception e) {
            return responseError(e.getMessage());
        }

      response.addHeader("Connection", "keep-alive");

      return response;
    }

    private Response responseError(String message){
        Log.e(TAG, message);
        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("message", message);
        responseBody.put("status", Response.Status.INTERNAL_ERROR.getRequestStatus());
        return generateResponse(Response.Status.INTERNAL_ERROR, responseBody);
    }

    private String getRealPathFromUri(Context context, Uri uri) {
        Cursor cursor = context.getContentResolver().query(uri, new String[]{ MediaStore.Video.Media.DATA }, null, null, null);
        if (cursor != null) {
            int index = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
            cursor.moveToFirst();
            String path = cursor.getString(index);
            cursor.close();
            return path;
        }
        return null;
    }

}
