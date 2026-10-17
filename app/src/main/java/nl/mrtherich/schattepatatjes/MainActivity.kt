package nl.mrtherich.schattepatatjes

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebSettings
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject

/** WorkClock-style native shell. Its UI is inside the APK; only /sp/api.php is remote. */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var updates: SchattepatatjesUpdater
    private var chooser: android.webkit.ValueCallback<Array<Uri>>? = null
    private val chooserCode = 42

    companion object {
        private const val ORIGIN = "https://mrtherich.nl"
        private const val PREFIX = "/sp/"
        private const val ENTRY = "$ORIGIN${PREFIX}index.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = 0xff5d8483.toInt()
        window.navigationBarColor = 0xffeee1ce.toInt()
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true // Android photo picker grants individual content URIs.
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        updates = SchattepatatjesUpdater(this) { event ->
            runOnUiThread {
                if (::webView.isInitialized) webView.evaluateJavascript(
                    "window.schattepatatjesUpdateEvent?.(${JSONObject.quote(event.toString())});", null
                )
            }
        }
        webView.addJavascriptInterface(UpdateBridge(), "SchattepatatjesUpdater")

        // AndroidX locally serves index.html/CSS/JS at the *same HTTPS origin* as PHP.
        // API requests are never intercepted: WebView sends their real POST bodies,
        // first-party session cookies and credentials to the PHP server unmodified.
        val loader = WebViewAssetLoader.Builder().setDomain("mrtherich.nl")
            .addPathHandler(PREFIX, WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val uri = request.url
                if (uri.scheme != "https" || uri.host != "mrtherich.nl") return null
                if (uri.path == "${PREFIX}api.php") return null
                // Prevent accidentally requesting HTML/JS from the host if an asset is absent.
                if (!isBundledAsset(uri.path.orEmpty())) return null
                return loader.shouldInterceptRequest(uri) ?: WebResourceResponse(
                    "text/plain", "UTF-8", 404, "Not Found", emptyMap(),
                    java.io.ByteArrayInputStream(ByteArray(0))
                )
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "mrtherich.nl" &&
                    isBundledAsset(uri.path.orEmpty())) return false
                if (request.isForMainFrame) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) { }
                    return true
                }
                return false
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView, callback: android.webkit.ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                chooser?.onReceiveValue(null)
                return try {
                    chooser = callback
                    startActivityForResult(params.createIntent(), chooserCode)
                    true
                } catch (_: Exception) {
                    chooser = null
                    callback.onReceiveValue(null)
                    false
                }
            }
        }
        setContentView(webView)
        webView.loadUrl(ENTRY)
    }

    private fun isBundledAsset(path: String): Boolean {
        // A module must stay inside our embedded, immutable assets. No remote JS fallback.
        if (path.matches(Regex("^/sp/styles/[a-zA-Z0-9_-]+\\.css$"))) return true
        if (path.matches(Regex("^/sp/modules/(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+\\.js$"))) return true
        return path in setOf(
        "${PREFIX}index.html", "${PREFIX}app.js", "${PREFIX}styles.css",
        "${PREFIX}manifest.webmanifest", "${PREFIX}assets/icon.svg",
        "${PREFIX}assets/icon-192.png", "${PREFIX}assets/icon-512.png",
        "${PREFIX}assets/apple-touch-icon.png"
        )
    }

    private inner class UpdateBridge {
        @JavascriptInterface fun appVersion(): String = updates.appVersion()
        @JavascriptInterface fun checkUpdates() = runOnUiThread { updates.beginCheck() }
        @JavascriptInterface fun installUpdate() = runOnUiThread { updates.beginInstall() }
    }

    @Deprecated("Activity result is used for the WebView photo picker")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == chooserCode) {
            chooser?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            chooser = null
        }
    }

    override fun onResume() {
        super.onResume()
        if (::updates.isInitialized) updates.onResume()
    }

    @Deprecated("Android back behavior remains compatible with the existing app")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        chooser?.onReceiveValue(null)
        chooser = null
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("SchattepatatjesUpdater")
            webView.destroy()
        }
        super.onDestroy()
    }
}
