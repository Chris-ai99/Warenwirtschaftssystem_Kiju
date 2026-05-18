package de.kiju.lager;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String TAG = "KiJuScanner";
    private static final String ACTION_DECODE_DATA = "android.intent.ACTION_DECODE_DATA";
    public static final String EXTRA_BARCODE = "de.kiju.lager.EXTRA_BARCODE";
    private static final String[] BARCODE_EXTRAS = {
        EXTRA_BARCODE,
        "barcode_string",
        "barocode",
        "barcode",
        "decode_data",
        "data",
        "com.symbol.datawedge.data_string"
    };

    private WebView webView;
    private String pendingBarcode;
    private boolean pageReady;
    private final StringBuilder hidBuffer = new StringBuilder();
    private long hidFirstAt;
    private long hidLastAt;
    private int hidChars;
    private BroadcastReceiver foregroundScanReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        enableFullscreen();
        setupWebView();
        registerForegroundScanReceiver();
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    @Override
    protected void onDestroy() {
        if (foregroundScanReceiver != null) {
            unregisterReceiver(foregroundScanReceiver);
            foregroundScanReceiver = null;
        }
        super.onDestroy();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        webView = new WebView(this);
        webView.setLayoutParams(
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new KiJuWebViewClient());
        setContentView(webView);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();
        webView.loadUrl(getString(R.string.kiju_server_url));
    }

    private void registerForegroundScanReceiver() {
        foregroundScanReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Log.i(TAG, "Foreground scan intent received: " + intent.getAction());
                handleIncomingIntent(intent);
            }
        };
        registerReceiver(foregroundScanReceiver, new IntentFilter(ACTION_DECODE_DATA));
    }

    public static String extractBarcodeFromIntent(Intent intent) {
        if (intent == null || intent.getExtras() == null) return null;

        for (String key : BARCODE_EXTRAS) {
            Object value = intent.getExtras().get(key);
            String barcode = extraToString(value);
            if (barcode != null && !barcode.trim().isEmpty()) {
                return barcode.trim();
            }
        }

        return null;
    }

    private static String extraToString(Object value) {
        if (value instanceof String) return (String) value;
        if (value instanceof byte[]) return new String((byte[]) value).trim();
        if (value instanceof char[]) return new String((char[]) value).trim();
        return null;
    }

    private void handleIncomingIntent(Intent intent) {
        String barcode = extractBarcodeFromIntent(intent);
        if (barcode == null || barcode.isEmpty()) {
            Log.i(TAG, "Scan intent without barcode data: " + (intent == null ? "null" : intent.getAction()));
            return;
        }
        Log.i(TAG, "Native scan received: " + barcode);
        pendingBarcode = barcode;
        dispatchPendingScan();
    }

    private void dispatchPendingScan() {
        if (webView == null || !pageReady || pendingBarcode == null) return;

        String barcodeJson = JSONObject.quote(pendingBarcode);
        Log.i(TAG, "Dispatching scan to WebView: " + pendingBarcode);
        pendingBarcode = null;
        webView.evaluateJavascript(
            "(function(barcode){" +
                "window.dispatchEvent(new CustomEvent('kiju-native-scan',{detail:{barcode:barcode}}));" +
                "var path=window.location.pathname||'';" +
                "if(path.indexOf('/scan/')!==0){" +
                    "window.location.href='/scan/suchen?barcode='+encodeURIComponent(barcode);" +
                "}" +
            "})(" + barcodeJson + ");",
            null
        );
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (event.getKeyCode() == KeyEvent.KEYCODE_ENTER || event.getKeyCode() == KeyEvent.KEYCODE_TAB) {
                if (commitHidBufferIfScan()) {
                    return true;
                }
                resetHidBuffer();
                return super.dispatchKeyEvent(event);
            }

            int unicode = event.getUnicodeChar();
            if (unicode > 0 && !Character.isISOControl(unicode)) {
                appendHidChar((char) unicode);
            }
        }

        return super.dispatchKeyEvent(event);
    }

    private void appendHidChar(char value) {
        long now = SystemClock.uptimeMillis();
        if (hidChars == 0 || now - hidLastAt > 700) {
            hidBuffer.setLength(0);
            hidFirstAt = now;
            hidChars = 0;
        }
        hidBuffer.append(value);
        hidLastAt = now;
        hidChars += 1;
    }

    private boolean commitHidBufferIfScan() {
        String value = hidBuffer.toString().trim();
        if (value.length() < 3) return false;

        long duration = Math.max(0, hidLastAt - hidFirstAt);
        long averageGap = hidChars > 1 ? duration / (hidChars - 1) : Long.MAX_VALUE;
        boolean looksLikeScanner = averageGap <= 80 || duration <= 600 || value.length() >= 6;

        if (!looksLikeScanner) return false;

        Log.i(TAG, "HID scan detected: " + value);
        pendingBarcode = value;
        resetHidBuffer();
        dispatchPendingScan();
        return true;
    }

    private void resetHidBuffer() {
        hidBuffer.setLength(0);
        hidFirstAt = 0;
        hidLastAt = 0;
        hidChars = 0;
    }

    private void enableFullscreen() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            return;
        }

        window.getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableFullscreen();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void showConnectionError() {
        String startUrl = getString(R.string.kiju_server_url);
        String escapedStartUrl = startUrl.replace("\\", "\\\\").replace("'", "\\'");
        String html =
            "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
                "<style>" +
                "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;" +
                "font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px}" +
                "main{max-width:360px;text-align:center}" +
                "h1{font-size:24px;margin:0 0 12px}p{line-height:1.4;margin:0 0 20px}" +
                "button{border:0;border-radius:8px;background:#0f766e;color:white;font-weight:700;" +
                "font-size:16px;padding:14px 18px;width:100%}" +
                "</style></head><body><main>" +
                "<h1>Keine Verbindung</h1>" +
                "<p>KiJu Lager konnte den Server nicht erreichen. Bitte WLAN und Server-Adresse prüfen.</p>" +
                "<button onclick=\"location.href='" + escapedStartUrl + "'\">Erneut versuchen</button>" +
                "</main></body></html>";

        webView.loadDataWithBaseURL(
            startUrl,
            html,
            "text/html",
            "UTF-8",
            null
        );
    }

    private final class KiJuWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();

            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                return false;
            }

            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                return true;
            }
            return true;
        }

        @Override
        public void onReceivedError(
            WebView view,
            WebResourceRequest request,
            WebResourceError error
        ) {
            if (request.isForMainFrame()) {
                pageReady = false;
                showConnectionError();
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageReady = true;
            dispatchPendingScan();
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            pageReady = false;
            handler.cancel();
            showConnectionError();
        }
    }
}
