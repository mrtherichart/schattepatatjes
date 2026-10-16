package nl.mrtherich.schattepatatjes;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

/** Checks a fixed HTTPS location, validates the signed APK and opens Android's installer. */
public final class UpdateManager {
    private static final String BASE = "https://mrtherich.nl/sp/updates/";
    private static final String META = BASE + "latest.json";
    private static final long MAX_APK_BYTES = 35L * 1024 * 1024;
    private final Activity activity;
    private final WebView webView;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile JSONObject latest;
    private volatile File checkedApk;
    private volatile boolean working;
    private volatile boolean waitingForPermission;

    public UpdateManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** Entry points are intentionally narrow: JavaScript cannot select a URL or file. */
    @JavascriptInterface public void checkUpdates() {
        if (working) return;
        working = true;
        event("checking", null, null, 0);
        worker.execute(() -> {
            try {
                HttpsURLConnection connection = connect(META);
                String data;
                try (InputStream in = connection.getInputStream()) {
                    byte[] bytes = readLimited(in, 8192);
                    data = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                } finally { connection.disconnect(); }
                JSONObject obj = new JSONObject(data);
                int code = obj.getInt("versionCode");
                String version = obj.getString("versionName");
                String filename = obj.getString("apk");
                String hash = obj.getString("sha256");
                if (code <= 0 || version.length() > 35 || !filename.matches("schattepatatjes-v[0-9]+\\.apk") || !hash.matches("[0-9a-fA-F]{64}"))
                    throw new Exception("De updategegevens zijn ongeldig.");
                if (code <= BuildConfig.VERSION_CODE) {
                    latest = null;
                    event("current", null, null, 0);
                } else {
                    latest = obj;
                    String notes = obj.optString("notes", "");
                    if (notes.length() > 300) notes = notes.substring(0, 300);
                    event("available", version, notes, 0);
                }
            } catch (Exception e) {
                event("error", null, "Updatecontrole niet beschikbaar. Controleer je verbinding of de hosting.", 0);
            } finally { working = false; }
        });
    }

    @JavascriptInterface public void installUpdate() {
        JSONObject info = latest;
        if (info == null || working) return;
        working = true;
        worker.execute(() -> {
            try {
                final int code = info.getInt("versionCode");
                final String filename = info.getString("apk");
                if (code <= BuildConfig.VERSION_CODE) throw new Exception("Geen nieuwe versie.");
                if (!filename.matches("schattepatatjes-v[0-9]+\\.apk")) throw new Exception("Ongeldige bestandsnaam.");
                String wanted = info.getString("sha256").toLowerCase(Locale.ROOT);
                File dir = new File(activity.getCacheDir(), "updates");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("Opslag niet beschikbaar.");
                File temp = new File(dir, "download.part");
                File target = new File(dir, filename);
                event("downloading", null, null, 0);
                HttpsURLConnection connection = connect(BASE + filename);
                long total = connection.getContentLengthLong();
                if (total > MAX_APK_BYTES) throw new Exception("Bestand is te groot.");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long count = 0;
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[32768];
                    int n, prev = -1;
                    while ((n = in.read(buffer)) != -1) {
                        count += n;
                        if (count > MAX_APK_BYTES) throw new Exception("Bestand is te groot.");
                        digest.update(buffer, 0, n);
                        out.write(buffer, 0, n);
                        int pct = total > 0 ? (int)Math.min(99, count * 100 / total) : 0;
                        if (pct != prev && (pct % 5 == 0 || pct >= 99)) { event("downloading", null, null, pct); prev = pct; }
                    }
                } finally { connection.disconnect(); }
                String actual = hex(digest.digest());
                if (!MessageDigest.isEqual(actual.getBytes(java.nio.charset.StandardCharsets.US_ASCII), wanted.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
                    throw new Exception("De download heeft een onjuist controlegetal.");
                if (!temp.renameTo(target)) throw new Exception("Opslaan is mislukt.");
                if (!isAuthenticUpdate(target, code)) throw new Exception("APK heeft niet de juiste Android-handtekening.");
                checkedApk = target;
                event("installing", null, null, 100);
                ui.post(this::openInstaller);
            } catch (Exception e) {
                event("error", null, "Update niet geïnstalleerd: " + e.getMessage(), 0);
            } finally { working = false; }
        });
    }

    private boolean isAuthenticUpdate(File apk, int code) {
        try {
            PackageManager pm = activity.getPackageManager();
            int flag = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo incoming = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flag);
            PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flag);
            if (incoming == null || !activity.getPackageName().equals(incoming.packageName)) return false;
            long proposed = Build.VERSION.SDK_INT >= 28 ? incoming.getLongVersionCode() : incoming.versionCode;
            if (proposed != code || proposed <= BuildConfig.VERSION_CODE) return false;
            Signature[] a = signatures(incoming);
            Signature[] b = signatures(installed);
            return a != null && b != null && a.length == 1 && b.length == 1 && Arrays.equals(a, b);
        } catch (Exception ex) { return false; }
    }
    private Signature[] signatures(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= 28) {
            return info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners();
        }
        return info.signatures;
    }

    public void resumePendingInstall() {
        if (!waitingForPermission || Build.VERSION.SDK_INT < 26) return;
        if (activity.getPackageManager().canRequestPackageInstalls()) {
            waitingForPermission = false;
            openInstaller();
        }
    }
    private void openInstaller() {
        File apk = checkedApk;
        if (apk == null || !apk.exists()) return;
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            waitingForPermission = true;
            event("permission", null, null, 0);
            Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(permission);
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(install);
        } catch (Exception e) {
            event("error", null, "De Android-installatie kon niet worden geopend.", 0);
        }
    }

    private HttpsURLConnection connect(String path) throws Exception {
        URL url = new URL(path);
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !"mrtherich.nl".equalsIgnoreCase(url.getHost()))
            throw new Exception("Onveilig updateadres.");
        HttpsURLConnection con = (HttpsURLConnection)url.openConnection();
        con.setInstanceFollowRedirects(false);
        con.setConnectTimeout(9000);
        con.setReadTimeout(15000);
        con.setRequestProperty("Accept", "application/json, application/vnd.android.package-archive");
        if (con.getResponseCode() != 200) { con.disconnect(); throw new Exception("Update is niet bereikbaar."); }
        return con;
    }
    private byte[] readLimited(InputStream in, int max) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] bytes = new byte[2048]; int n;
        while ((n = in.read(bytes)) != -1) {
            if (out.size() + n > max) throw new Exception("Updategegevens zijn te groot.");
            out.write(bytes, 0, n);
        }
        return out.toByteArray();
    }
    private String hex(byte[] data) {
        StringBuilder sb = new StringBuilder(data.length * 2);
        for (byte b : data) sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return sb.toString();
    }
    private void event(String status, String version, String message, int progress) {
        try {
            JSONObject data = new JSONObject();
            data.put("status", status);
            if (version != null) data.put("version", version);
            if (message != null) data.put(status.equals("available") ? "notes" : "message", message);
            data.put("progress", progress);
            String js = "window.schattepatatjesUpdateEvent && window.schattepatatjesUpdateEvent(" + JSONObject.quote(data.toString()) + ");";
            ui.post(() -> webView.evaluateJavascript(js, null));
        } catch (Exception ignored) { }
    }
}
