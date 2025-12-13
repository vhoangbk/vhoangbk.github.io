package com.diff.beeconvert;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class VideoHelper {

    public static class VideoItem {
        public String id;
        public String title;
        public String mimeType;
        public String path;

        public String thumb;
        public long duration;
        public long size;
        public long width;
        public long height;
        public String displayName;
        public long dateAdded;
        public String codec;
    }

//    public static class FolderItem {
//        public String bucketId;
//        public String bucketName;
//        public List<VideoItem> videos = new ArrayList<>();
//
//        public FolderItem(String bucketId, String bucketName) {
//            this.bucketId = bucketId;
//            this.bucketName = bucketName;
//        }
//    }

//    public static List<VideoItem> getAllVideos(ContentResolver contentResolver, String sortBy, int pageSize, int page, String excludeFolderPath) {
//        List<VideoItem> videoList = new ArrayList<>();
//
//        Uri collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
//
//        String[] projection = {
//                MediaStore.Video.Media._ID,
//                MediaStore.Video.Media.TITLE,
//                MediaStore.Video.Media.DATA,
//                MediaStore.Video.Media.DURATION,
//                MediaStore.Video.Media.SIZE,
//                MediaStore.Video.Media.MIME_TYPE,
//                MediaStore.Video.Media.WIDTH,
//                MediaStore.Video.Media.HEIGHT,
//                MediaStore.Video.Media.DISPLAY_NAME,
//        };
//
//        String sortField = MediaStore.Images.Media.DATE_ADDED;
//        if (sortBy.equalsIgnoreCase("biggest") || sortBy.equalsIgnoreCase("smallest")) {
//            sortField = MediaStore.Images.Media.SIZE;
//        } else if (sortBy.equalsIgnoreCase("shortest") || sortBy.equalsIgnoreCase("longest")) {
//            sortField = MediaStore.Images.Media.DURATION;
//        } else if (sortBy.equalsIgnoreCase("atoz") || sortBy.equalsIgnoreCase("ztoa")) {
//            sortField = MediaStore.Images.Media.TITLE;
//        }
//
//        String sortValue = "DESC";
//        if (sortBy.equalsIgnoreCase("oldest") ||
//                sortBy.equalsIgnoreCase("smallest") ||
//                sortBy.equalsIgnoreCase("shortest") ||
//                sortBy.equalsIgnoreCase("ztoa")) {
//            sortValue = "ASC";
//        }
//
//        String selection = null;
//        String[] selectionArgs = null;
//
//        if (excludeFolderPath != null && !excludeFolderPath.isEmpty()) {
//            selection = MediaStore.Video.Media.RELATIVE_PATH + " NOT LIKE ?";
//            selectionArgs = new String[]{"%" + excludeFolderPath + "%"};
//        }
//
//
//        Utils.log("sortField: ", sortField);
//        Utils.log("sortValue: ", sortValue);
//
//        Cursor cursor = contentResolver.query(
//                collection,
//                projection,
//                selection,
//                selectionArgs,
//                sortField + " " + sortValue
//        );
//
//        if (cursor != null) {
//            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
//            int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.TITLE);
//            int dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
//            int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION);
//            int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE);
//            int mimeTypeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE);
//            int widthColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH);
//            int heightColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT);
//            int displayNameColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME);
//
//            int count = 0;
//            int offset = pageSize * page;
//            while (cursor.moveToNext()) {
//                String path = cursor.getString(dataColumn);
//
//                File file = new File(path);
//                if (!file.exists()) {
//                    continue;
//                }
//
//                if (count >= offset && videoList.size() < pageSize) {
//                    String mimeType = cursor.getString(mimeTypeColumn);
//                    VideoItem video = new VideoItem();
//                    video.id = cursor.getString(idColumn);
//                    video.title = cursor.getString(titleColumn);
//                    video.mimeType = mimeType;
//                    video.path = path;
//                    video.duration  = cursor.getLong(durationColumn);
//                    video.size = cursor.getLong(sizeColumn);
//                    video.width = cursor.getLong(widthColumn);
//                    video.height = cursor.getLong(heightColumn);
//                    video.displayName = cursor.getString(displayNameColumn);
//                    videoList.add(video);
//                }
//                count++;
//                if (videoList.size() == pageSize) break;
//            }
//            cursor.close();
//        }
//        return videoList;
//    }

    public static List<VideoItem> getSaveVideos(ContentResolver contentResolver, String sortBy, int pageSize, int page) {
        List<VideoItem> videoList = new ArrayList<>();

        Uri collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;

        String[] projection = {
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.TITLE,
                MediaStore.Video.Media.DATA,
                MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.MIME_TYPE,
                MediaStore.Video.Media.WIDTH,
                MediaStore.Video.Media.HEIGHT,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.DATE_ADDED,
        };

        String sortField = MediaStore.Images.Media.DATE_ADDED;
        if (sortBy.equalsIgnoreCase("biggest") || sortBy.equalsIgnoreCase("smallest")) {
            sortField = MediaStore.Images.Media.SIZE;
        } else if (sortBy.equalsIgnoreCase("shortest") || sortBy.equalsIgnoreCase("longest")) {
            sortField = MediaStore.Images.Media.DURATION;
        } else if (sortBy.equalsIgnoreCase("atoz") || sortBy.equalsIgnoreCase("ztoa")) {
            sortField = MediaStore.Images.Media.TITLE;
        }

        String sortValue = "DESC";
        if (sortBy.equalsIgnoreCase("oldest") ||
                sortBy.equalsIgnoreCase("smallest") ||
                sortBy.equalsIgnoreCase("shortest") ||
                sortBy.equalsIgnoreCase("ztoa")) {
            sortValue = "ASC";
        }

        String relativeFolderPath = WebServer.SAVED_FOLDER + "/";
        String selection = MediaStore.Video.Media.RELATIVE_PATH + " LIKE ?";
        String[] selectionArgs = new String[]{"%" + relativeFolderPath};

        Cursor cursor = contentResolver.query(
                collection,
                projection,
                selection,
                selectionArgs,
                sortField + " " + sortValue
        );

        if (cursor != null) {
            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
            int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.TITLE);
            int dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
            int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION);
            int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE);
            int mimeTypeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE);
            int widthColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH);
            int heightColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT);
            int displayNameColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME);
            int dateAddedColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_ADDED);

            int count = 0;
            int offset = pageSize * page;
            while (cursor.moveToNext()) {
                String path = cursor.getString(dataColumn);

                File file = new File(path);
                if (!file.exists()) {
                    continue;
                }

                if (count >= offset && videoList.size() < pageSize) {
                    long id = cursor.getLong(idColumn);
                    Uri contentUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id);
                    String mimeType = cursor.getString(mimeTypeColumn);
                    VideoItem video = new VideoItem();
                    video.id = String.valueOf(id);
                    video.title = cursor.getString(titleColumn);
                    video.mimeType = mimeType;
                    video.path = path;
                    video.duration  = Math.round((float) cursor.getLong(durationColumn) / 1000);
                    video.size = cursor.getLong(sizeColumn);
                    video.width = cursor.getLong(widthColumn);
                    video.height = cursor.getLong(heightColumn);
                    video.displayName = cursor.getString(displayNameColumn);
                    video.dateAdded = cursor.getLong(dateAddedColumn);
                    video.codec = getVideoCodec(contentResolver, contentUri);
                    videoList.add(video);
                }
                count++;
                if (videoList.size() == pageSize) break;
            }
            cursor.close();
        }
        return videoList;
    }

    public static String getVideoCodec(ContentResolver contentResolver, Uri uri) {
        MediaExtractor extractor = new MediaExtractor();
        try {
            ParcelFileDescriptor pfd =
                contentResolver.openFileDescriptor(uri, "r");
            if (pfd == null) return null;

            extractor.setDataSource(pfd.getFileDescriptor());

            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/")) {
                    return mime;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            extractor.release();
        }
        return null;
    }

//    public static List<FolderItem> getAllFolder(ContentResolver contentResolver, String excludeFolderName) {
//        Map<String, FolderItem> folderMap = new HashMap<>();
//        Uri collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
//
//        String[] projection = {
//                MediaStore.Video.Media.BUCKET_ID,
//                MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
//                MediaStore.Video.Media._ID,
//                MediaStore.Video.Media.TITLE,
//                MediaStore.Video.Media.DATA,
//                MediaStore.Video.Media.DURATION,
//                MediaStore.Video.Media.SIZE,
//                MediaStore.Video.Media.MIME_TYPE,
//                MediaStore.Video.Media.WIDTH,
//                MediaStore.Video.Media.HEIGHT,
//                MediaStore.Video.Media.DISPLAY_NAME,
//        };
//
//        String selection = null;
//        String[] selectionArgs = null;
//
//        if (excludeFolderName != null && !excludeFolderName.isEmpty()) {
//            selection = MediaStore.Video.Media.BUCKET_DISPLAY_NAME + " != ?";
//            selectionArgs = new String[]{excludeFolderName};
//        }
//
//        Cursor cursor = contentResolver.query(
//                collection,
//                projection,
//                selection,
//                selectionArgs,
//                MediaStore.Video.Media.DATE_ADDED + " DESC"
//        );
//
//        if (cursor != null) {
//            int bucketIdCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.BUCKET_ID);
//            int bucketNameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.BUCKET_DISPLAY_NAME);
//
//            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
//            int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.TITLE);
//            int dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
//            int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION);
//            int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE);
//            int mimeTypeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE);
//            int widthColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH);
//            int heightColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT);
//            int displayNameColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME);
//
//            while (cursor.moveToNext()) {
//                String bucketId = cursor.getString(bucketIdCol);
//                String bucketName = cursor.getString(bucketNameCol);
//
//                String path = cursor.getString(dataColumn);
//                String mimeType = cursor.getString(mimeTypeColumn);
//                VideoItem video = new VideoItem();
//                video.id = cursor.getString(idColumn);
//                video.title = cursor.getString(titleColumn);
//                video.mimeType = mimeType;
//                video.path = path;
//                video.duration  = Math.round((float) cursor.getLong(durationColumn) / 1000);
//                video.size = cursor.getLong(sizeColumn);
//                video.width = cursor.getLong(widthColumn);
//                video.height = cursor.getLong(heightColumn);
//                video.displayName = cursor.getString(displayNameColumn);
//
//                if (!folderMap.containsKey(bucketId)) {
//                    folderMap.put(bucketId, new FolderItem(bucketId, bucketName));
//                }
//                // Thêm video vào folder
//                folderMap.get(bucketId).videos.add(video);
//
//            }
//            cursor.close();
//        }
//
//        return new ArrayList<>(folderMap.values());
//    }
}
