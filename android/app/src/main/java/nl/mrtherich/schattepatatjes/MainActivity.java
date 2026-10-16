package nl.mrtherich.schattepatatjes;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Offline WebView shell. Only the /sp/api.php endpoint reaches the PHP server. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://mrtherich.nl";
    private static final String PREFIX = "/sp/";
    private static final String ENTRY = ORIGIN + PREFIX;
    private static final Set<String> LOCAL_FILES = new HashSet<>(Arrays.asList(
            "index.html", "styles.css", "app.js", "manifest.webmanifest",
            "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png",
            "assets/apple-touch-icon.png"));
    private static final int PICK_FILE = 42;
    private WebView webView;
    private UpdateManager updates;
    private ValueCallback<Uri[]> fileCallback;

    private WebResourceResponse localPage(Uri url) {
        if (!"https".equalsIgnoreCase(url.getScheme()) ||
                !"mrtherich.nl".equalsIgnoreCase(url.getHost()) ||
                url.getPort() != -1) return null;
        String path = url.getPath();
        if (path == null || !path.startsWith(PREFIX)) return null;
        String asset = path.substring(PREFIX.length());
        if (asset.isEmpty()) asset = "index.html";
        if (!LOCAL_FILES.contains(asset)) return null;
        String type = "text/html";
        if (asset.endsWith(".js")) type = "text/javascript";
        else if (asset.endsWith(".css")) type = "text/css";
        else if (asset.endsWith(".svg")) type = "image/svg+xml";
        else if (asset.endsWith(".png")) type = "image/png";
        else if (asset.endsWith(".webmanifest")) type = "application/manifest+json";
        try {
            InputStream stream = getAssets().open("web/" + asset);
            return new WebResourceResponse(type, "UTF-8", stream);
        } catch (IOException ex) {
            return null;
        }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xff5d8483);
        getWindow().setNavigationBarColor(0xffeee1ce);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        updates = new UpdateManager(this, webView);
        webView.addJavascriptInterface(updates, "SchattepatatjesUpdater");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localPage(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (request.isForMainFrame() && "https".equals(url.getScheme()) &&
                        "mrtherich.nl".equalsIgnoreCase(url.getHost()) &&
                        url.getPath() != null && url.getPath().startsWith(PREFIX)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                catch (Exception ignored) { }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE);
                    return true;
                } catch (Exception ex) {
                    fileCallback = null;
                    return false;
                }
            }
        });
        webView.loadUrl(ENTRY);
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onResume() {
        super.onResume();
        if (updates != null) updates.resumePendingInstall();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
