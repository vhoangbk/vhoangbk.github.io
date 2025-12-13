package com.diff.beeconvert;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;

public class ConversionNotification {
  private static final String CHANNEL_ID = "bee_convert_channel";
  private static final int NOTIFICATION_ID = 1;
  private static final int NOTIFICATION_ID_COMPLETED = 2;

  private final Context context;
  private Service service;

  public ConversionNotification(Context context, Service service){
    this.context = context;
    this.service = service;
  }

  public void createNotificationChannel() {
    NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID, "BeeConvert Service Channel", NotificationManager.IMPORTANCE_LOW);
    NotificationManager manager = this.context.getSystemService(NotificationManager.class);
    manager.createNotificationChannel(channel);
  }

  public PendingIntent createPendingIntent() {
    Intent notificationIntent = this.context.getPackageManager().getLaunchIntentForPackage(this.context.getPackageName());
    if (notificationIntent != null) {
      notificationIntent.setPackage(null);
    }
    return PendingIntent.getActivity(this.context, 0, notificationIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  @SuppressLint("ForegroundServiceType")
  public void showNotification(String message){
    PendingIntent pendingIntent = createPendingIntent();
    @SuppressLint("NotificationTrampoline")
    Notification notification = new NotificationCompat.Builder(this.context, CHANNEL_ID)
        .setContentTitle("BeeConvert")
        .setContentText(message)
        .setSmallIcon(R.drawable.ic_notification)
        .setOngoing(true)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .build();
    NotificationManager manager =
        (NotificationManager) this.context.getSystemService(Context.NOTIFICATION_SERVICE);
    service.startForeground(NOTIFICATION_ID, notification);
  }

  public void updateNotification(String message, boolean completed) {
    PendingIntent pendingIntent = createPendingIntent();
    @SuppressLint("NotificationTrampoline")
    Notification notification = new NotificationCompat.Builder(this.context, CHANNEL_ID)
        .setContentTitle("BeeConvert")
        .setContentText(message)
        .setSmallIcon(R.drawable.ic_notification)
        .setOngoing(true)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .build();
    NotificationManager manager = (NotificationManager) this.context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (completed) {
      manager.notify(NOTIFICATION_ID_COMPLETED, notification);
    } else {
      manager.notify(NOTIFICATION_ID, notification);
    }


  }

}
