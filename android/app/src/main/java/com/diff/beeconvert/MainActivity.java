package com.diff.beeconvert;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends AppCompatActivity {
  WebView webView;
  int port = 8282;

  private WebServer webServer;

  private ValueCallback<Uri[]> mFilePathCallback;
  private static final int PERMISSION_REQUEST_CODE = 1001;
  private static final String TAG = "MainActivity";
  public static final String TEST_DEVICE_HASHED_ID = "9473cd50-e95e-4439-8f41-2d4deedd54c6";
  private static final String AD_UNIT_ID = "ca-app-pub-3631342752645707/6406271060";
  private static final String AD_UNIT_ID_INTERSTITIAL = "ca-app-pub-3631342752645707/5561406333";
  private final AtomicBoolean isMobileAdsInitializeCalled = new AtomicBoolean(false);
  private AdView adView;
  private FrameLayout adContainerView;
  private InterstitialAd mInterstitialAd;

  private boolean inAppPurchased = false;

  private final ActivityResultLauncher<Intent> mStartActivityForResult = registerForActivityResult(
      new ActivityResultContracts.StartActivityForResult(),
      result -> {

        if (mFilePathCallback == null) return;

        Uri[] results = null;

        if (result.getResultCode() == Activity.RESULT_OK) {
          Intent data = result.getData();
          if (data != null) {
            List<Uri> validUris = new ArrayList<>();

            if (data.getClipData() != null) {
              int count = data.getClipData().getItemCount();
              for (int i = 0; i < count; i++) {
                Uri uri = data.getClipData().getItemAt(i).getUri();
                if (isUriAvailable(uri)) {
                  Uri processedUri = takePersistableUriPermission(uri);
                  validUris.add(processedUri);
                } else {
                  Log.w(TAG, "⚠️ File not found or inaccessible: " + uri);
                  Toast.makeText(MainActivity.this, "File not found or inaccessible", Toast.LENGTH_SHORT).show();
                }
              }
            } else if (data.getData() != null) {
              Uri uri = data.getData();
              if (isUriAvailable(uri)) {
                Uri processedUri = takePersistableUriPermission(uri);
                validUris.add(processedUri);
              } else {
                Log.w(TAG, "⚠️ File not found or inaccessible: " + uri);
                Toast.makeText(MainActivity.this, "File not found or inaccessible", Toast.LENGTH_SHORT).show();
              }
            }

            if (!validUris.isEmpty()) {
              results = validUris.toArray(new Uri[0]);
            }
          }
        }


        mFilePathCallback.onReceiveValue(results);
        mFilePathCallback = null;
      }
  );

  // Take persistent URI permission
  private Uri takePersistableUriPermission(Uri uri) {
    if (!isUriAvailable(uri)) return null;
    try {
      getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
      Log.d(TAG, "✅ Persistent permission granted: " + uri);
      return uri;
    } catch (SecurityException e) {
      Log.d(TAG, "⚠️ Using temporary access: " + uri);
      return uri; // Return original URI anyway
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      getWindow().setDecorFitsSystemWindows(false);
    }
    setContentView(R.layout.activity_main);
    View rootView = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
      Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
      v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
      return WindowInsetsCompat.CONSUMED;
    });
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    //set color status bar và navigation bar
    Window window = getWindow();
    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
    window.setNavigationBarColor(ContextCompat.getColor(this, R.color.navigation_bar));

    adContainerView = findViewById(R.id.ad_view_container);

    try {
      String ip = Utils.getDeviceIpAddress(MainActivity.this);
      port = Utils.getAvailablePort();
      webServer = new WebServer(port);
      webServer.setContext(MainActivity.this);
      webServer.start();
      Log.d(TAG, "Server started at: http://" + ip + ":" + port);
    } catch (IOException e) {
      Log.e(TAG, "Failed to start web server", e);
    }

    checkAndRequestPermissions();

    webView = findViewById(R.id.browser);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);

    webView.setWebChromeClient(wcc);
    webView.setWebViewClient(new WebViewClient());
    settings.setAllowFileAccess(true);
    settings.setAllowUniversalAccessFromFileURLs(true);
    settings.setAllowFileAccessFromFileURLs(true);
    WebView.setWebContentsDebuggingEnabled(true);
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    webView.setVerticalScrollBarEnabled(false);
    webView.setHorizontalScrollBarEnabled(false);
    String defaultUA = webView.getSettings().getUserAgentString();
    webView.getSettings().setUserAgentString(defaultUA + " beeconvertapp");
    webView.addJavascriptInterface(new WebAppInterface(this), "AndroidInterface");

    String url = String.format("http://localhost:%s/m-index.html", port);
    webView.loadUrl(url);

    if (!inAppPurchased) {
      initializeMobileAdsSdk();
    }

    loadInterstitialAd();

    OnBackPressedCallback callback = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        if (webView.canGoBack()) {
          webView.goBack();
        }
      }
    };

    getOnBackPressedDispatcher().addCallback(this, callback);

    new Handler(Looper.getMainLooper()).postDelayed(() -> {
      sendToWebView("PurchaseStatus", true);
    }, 2000);
  }

  WebChromeClient wcc = new WebChromeClient() {

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {

      try {
        Intent fileChooserIntent = fileChooserParams.createIntent();

        // Enhanced flags for better file access
        fileChooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        fileChooserIntent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        fileChooserIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        fileChooserIntent.addCategory(Intent.CATEGORY_OPENABLE);

        // Prefer Document Provider
        fileChooserIntent.setAction(Intent.ACTION_OPEN_DOCUMENT);

        mStartActivityForResult.launch(fileChooserIntent);
        mFilePathCallback = filePathCallback;
        return true;
      } catch (Exception e) {
        Log.e(TAG, "Cannot create file chooser intent", e);
        return false;
      }
    }
  };

  private boolean isUriAvailable(Uri uri) {
    if (uri == null) return false;

    try (InputStream stream = getContentResolver().openInputStream(uri)) {
      return stream != null;
    } catch (Exception e) {
      return false;
    }
  }

  private void checkAndRequestPermissions() {
    ArrayList<String> permissionsToRequest = new ArrayList<>();
    // Android 13 or lastest
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
        permissionsToRequest.add(Manifest.permission.READ_MEDIA_VIDEO);
      }
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS);
      }
    } else {
      // < Android 13
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
        permissionsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE);
      }
    }

    if (!permissionsToRequest.isEmpty()) {
      ActivityCompat.requestPermissions(this, permissionsToRequest.toArray(new String[0]), PERMISSION_REQUEST_CODE);
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == PERMISSION_REQUEST_CODE) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        Log.d(TAG, "Storage Permission Granted.");
      } else {
        Log.d(TAG, "Storage Permission Denied.");
      }
    }
  }

  @Override
  public void onPause() {
    if (adView != null) {
      adView.pause();
    }
    super.onPause();
  }

  @Override
  public void onResume() {
    super.onResume();
    if (adView != null) {
      adView.resume();
    }
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
    if (adView != null) {
      adView.destroy();
    }
    if (webServer != null) {
      webServer.stop();
    }
  }

  private void initializeMobileAdsSdk() {
    if (isMobileAdsInitializeCalled.getAndSet(true)) {
      return;
    }

    // Set your test devices.
    MobileAds.setRequestConfiguration(
        new RequestConfiguration.Builder()
            .setTestDeviceIds(Arrays.asList(TEST_DEVICE_HASHED_ID))
            .build());

    new Thread(
        () -> {
          MobileAds.initialize(this, initializationStatus -> {
          });
          runOnUiThread(this::loadBanner);
        })
        .start();
  }

  private void loadBanner() {
    adView = new AdView(this);
    adView.setAdUnitId(AD_UNIT_ID);
    adView.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, 360));

    adContainerView.removeAllViews();
    adContainerView.addView(adView);

    AdRequest adRequest = new AdRequest.Builder().build();
    adView.loadAd(adRequest);

    if (adView != null) {
      adView.setAdListener(
          new AdListener() {
            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError adError) {
              Log.d(TAG, "onAdFailedToLoad" + adError);
            }

            @Override
            public void onAdLoaded() {
              Log.d(TAG, "onAdLoaded");
            }

            @Override
            public void onAdOpened() {
              Log.d(TAG, "onAdOpened");
            }
          });
    }
  }

  public void loadInterstitialAd() {
    AdRequest adRequest = new AdRequest.Builder().build();
    InterstitialAd.load(this, AD_UNIT_ID_INTERSTITIAL, adRequest,
        new InterstitialAdLoadCallback() {
          @Override
          public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
            mInterstitialAd = interstitialAd;
            Log.d(TAG, "InterstitialAd onAdLoaded");
          }

          @Override
          public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
            Log.d(TAG, "InterstitialAd onAdFailedToLoad" + loadAdError);
            mInterstitialAd = null;
          }
        });
  }

  private void showInterstitialAd() {
    if (mInterstitialAd != null) {
      mInterstitialAd.show(MainActivity.this);
      mInterstitialAd.setFullScreenContentCallback(new FullScreenContentCallback() {
        @Override
        public void onAdDismissedFullScreenContent() {
          Log.d(TAG, "The ad was dismissed.");
          loadInterstitialAd();
          sendToWebView("adDismissed", null);
        }

        @Override
        public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
          super.onAdFailedToShowFullScreenContent(adError);
          Log.d(TAG, "The ad failed to show.");
          sendToWebView("adShowFailed", null);
        }

        @Override
        public void onAdShowedFullScreenContent() {
          mInterstitialAd = null;
          Log.d(TAG, "The ad was shown.");
        }
      });

    } else {
      Log.d(TAG, "The interstitial ad wasn't ready yet.");
    }
  }

  private void sendToWebView(String event, Object data) {
    String script = String.format("javascript:fromAndroid('%s', '%s')", event, data);
    runOnUiThread(() -> {
      webView.evaluateJavascript(script, null);
    });
  }

  public class WebAppInterface {
    Context mContext;

    WebAppInterface(Context c) {
      mContext = c;
    }

    @JavascriptInterface
    public void showAds() {
      runOnUiThread(MainActivity.this::showInterstitialAd);
    }

    @JavascriptInterface
    public void shareVideo(String videoId, String videoName) {
      runOnUiThread(() -> startShareIntent(videoId, videoName));
    }

    @JavascriptInterface
    public void onConversionStart() {
      Log.d(TAG, "Conversion started ");

      Intent serviceIntent = new Intent(MainActivity.this, ConversionService.class);
      serviceIntent.setAction(ConversionService.ACTION_START);
      startForegroundService(serviceIntent);
    }

    @JavascriptInterface
    public void onConversionFinished() {
      Log.d(TAG, "Conversion finished");
      Intent serviceIntent = new Intent(mContext, ConversionService.class);
      serviceIntent.setAction(ConversionService.ACTION_FINISHED);
      startForegroundService(serviceIntent);
    }

    @JavascriptInterface
    public void onConversionProgress(String message) {
      Log.d(TAG, "Conversion Progress "+ message);
      Intent serviceIntent = new Intent(mContext, ConversionService.class);
      serviceIntent.putExtra("message", message);
      serviceIntent.setAction(ConversionService.ACTION_PROGRESS);
      startForegroundService(serviceIntent);
    }

    @JavascriptInterface
    public void onConversionFailed() {
      Log.d(TAG, "Conversion failed");
      stopConvertService();
    }

    @JavascriptInterface
    public void onConversionCancel() {
      Log.d(TAG, "Conversion cancel");
      stopConvertService();
    }

  }

  private void stopConvertService(){
    Intent serviceIntent = new Intent(MainActivity.this, ConversionService.class);
    stopService(serviceIntent);
  }

  private void startShareIntent(String videoId, String videoName) {
    try {
      long id = Long.parseLong(videoId);
      Uri videoUri = android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI.buildUpon()
          .appendPath(String.valueOf(id)).build();

      Intent shareIntent = new Intent(Intent.ACTION_SEND);
      shareIntent.setType("video/*");
      shareIntent.putExtra(Intent.EXTRA_STREAM, videoUri);
      shareIntent.putExtra(Intent.EXTRA_SUBJECT, videoName);
      shareIntent.putExtra(Intent.EXTRA_TEXT, "Check out this video: " + videoName);
      shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivity(Intent.createChooser(shareIntent, "Share " + videoName + " via..."));
    } catch (NumberFormatException e) {
      Log.e(TAG, "Invalid video ID format for sharing: " + videoId, e);
    } catch (Exception e) {
      Log.e(TAG, "Error creating share intent for video ID: " + videoId, e);
    }
  }

}
