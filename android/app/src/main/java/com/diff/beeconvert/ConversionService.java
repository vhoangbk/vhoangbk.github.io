package com.diff.beeconvert;

import android.annotation.SuppressLint;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import java.util.Objects;


public class ConversionService extends Service {

  private static final String TAG = "ConversionService";
  public static final String ACTION_START = "com.diff.beeconvert.action.START_CONVERSION";
  public static final String ACTION_FINISHED = "com.diff.beeconvert.action.FINISHED_CONVERSION";
  public static final String ACTION_PROGRESS = "com.diff.beeconvert.action.FINISHED_PROGRESS";

  private PowerManager.WakeLock wakeLock;
  private ConversionNotification conversionNotification;

  @Override
  public void onCreate() {
    super.onCreate();

      PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
      wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
          "BeeConvert::ConversionWakelockTag");
      wakeLock.acquire(10*60*1000L /*10 minutes*/);
      conversionNotification = new ConversionNotification(this, this);
      conversionNotification.createNotificationChannel();
      conversionNotification.showNotification("Video conversion is progressing...");
  }

  @SuppressLint("ForegroundServiceType")
  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent.getAction();
    switch (Objects.requireNonNull(action)) {
      case ACTION_START:
        conversionNotification.showNotification("Video conversion is progressing...");
        break;
      case ACTION_FINISHED:
        conversionNotification.updateNotification("Video conversion is completed", true);
        stopSelf();
        break;
      case ACTION_PROGRESS:
        String message = intent.getStringExtra("message");
        conversionNotification.updateNotification(message, false);
        break;
    }
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    Log.d(TAG, "Service is being destroyed.");
    if (wakeLock != null && wakeLock.isHeld()) {
      wakeLock.release();
      Log.d(TAG, "WakeLock released.");
    }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

}
