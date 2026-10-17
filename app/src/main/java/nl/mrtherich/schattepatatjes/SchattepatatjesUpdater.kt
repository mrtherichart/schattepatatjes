package nl.mrtherich.schattepatatjes

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import kotlin.concurrent.thread

/** WorkClock-style GitHub Releases updates; no third-party updater or background service. */
class SchattepatatjesUpdater(
    private val activity: MainActivity,
    private val send: (JSONObject) -> Unit
) {
    companion object {
        private const val API = "https://api.github.com/repos/mrtherichart/schattepatatjes/releases/latest"
        private const val DOWNLOAD_PREFIX = "https://github.com/mrtherichart/schattepatatjes/releases/download/"
        private const val APK_NAME = "Schattepatatjes.apk"
        private const val MAX_BYTES = 80L * 1024 * 1024
        // The certificate already used for Schattepatatjes v0.3 and v0.4.
        private const val PINNED_CERT = "ca6ff34569063ff00cb086d18ca95e24a1bb9d479c9df07f1892ac6d9e73ea77"
    }

    private data class Candidate(val version: String, val url: String, val sha256: String, val notes: String)
    private val ui = Handler(Looper.getMainLooper())
    @Volatile private var candidate: Candidate? = null
    @Volatile private var busy = false
    private var pendingInstall: File? = null

    fun appVersion(): String = try {
        activity.packageManager.getPackageInfo(activity.packageName, 0).versionName ?: "?"
    } catch (_: Exception) { "?" }
    private fun versionCode(): Long = try {
        val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
    } catch (_: Exception) { 0L }

    fun beginCheck() {
        if (busy) return
        busy = true
        notify("checking", "Controleren op GitHub Releases…")
        thread(name = "Schattepatatjes-update-check") {
            try {
                val data = JSONObject(readMetadata(API))
                val tag = data.getString("tag_name").removePrefix("v")
                val assets = data.getJSONArray("assets")
                var asset: JSONObject? = null
                for (i in 0 until assets.length()) {
                    val entry = assets.getJSONObject(i)
                    if (entry.optString("name") == APK_NAME && entry.optString("state") == "uploaded") {
                        asset = entry
                        break
                    }
                }
                val entry = asset ?: error("Deze release bevat nog geen Schattepatatjes.apk.")
                val url = entry.getString("browser_download_url")
                require(url.startsWith(DOWNLOAD_PREFIX) && url.endsWith("/$APK_NAME")) {
                    "Het updateadres is niet vertrouwd."
                }
                val sha = entry.optString("digest")
                require(sha.matches(Regex("sha256:[a-fA-F0-9]{64}"))) {
                    "GitHub heeft geen geldig SHA-256-controlegetal verstrekt."
                }
                if (compareVersions(tag, appVersion()) <= 0) {
                    candidate = null
                    notify("current", "Je hebt de nieuwste versie.")
                } else if (!hasStableSignature()) {
                    candidate = null
                    notify("error", "Deze installatie gebruikt niet de officiële ondertekeningssleutel.")
                } else {
                    val notes = data.optString("body").take(300)
                    candidate = Candidate(tag, url, sha.removePrefix("sha256:").lowercase(Locale.US), notes)
                    notify("available", "Schattepatatjes $tag staat klaar.", tag, notes = notes)
                }
            } catch (e: Exception) {
                candidate = null
                notify("error", "Updatecontrole niet beschikbaar: ${e.message ?: "netwerkfout"}")
            } finally { busy = false }
        }
    }

    fun beginInstall() {
        val update = candidate ?: run {
            notify("error", "Controleer eerst op updates.")
            return
        }
        if (busy) return
        if (!hasStableSignature()) {
            notify("error", "De Android-ondertekening klopt niet.")
            return
        }
        busy = true
        notify("downloading", "Nieuwe versie downloaden…", update.version, progress = 0)
        thread(name = "Schattepatatjes-update-download") {
            val folder = File(activity.cacheDir, "updates")
            val tmp = File(folder, "download.part")
            val apk = File(folder, APK_NAME)
            try {
                folder.mkdirs()
                val digest = MessageDigest.getInstance("SHA-256")
                val conn = connect(update.url)
                try {
                    val length = conn.contentLengthLong
                    if (length > MAX_BYTES) error("De APK is onverwacht groot.")
                    var received = 0L
                    var lastProgress = -1
                    conn.inputStream.use { input ->
                        tmp.outputStream().use { out ->
                            val buf = ByteArray(32768)
                            while (true) {
                                val count = input.read(buf)
                                if (count < 0) break
                                received += count
                                if (received > MAX_BYTES) error("De APK is te groot.")
                                out.write(buf, 0, count)
                                digest.update(buf, 0, count)
                                if (length > 0) {
                                    val progress = (received * 100 / length).toInt().coerceIn(0, 99)
                                    if (progress != lastProgress && progress % 5 == 0) {
                                        lastProgress = progress
                                        notify("downloading", "Nieuwe versie downloaden…", update.version, progress = progress)
                                    }
                                }
                            }
                        }
                    }
                } finally { conn.disconnect() }
                val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
                if (!MessageDigest.isEqual(actual.toByteArray(), update.sha256.toByteArray()))
                    error("Het SHA-256-controlegetal klopt niet.")
                if (apk.exists()) apk.delete()
                if (!tmp.renameTo(apk)) error("De APK kon niet worden opgeslagen.")
                if (!isSameAppAndSigner(apk)) error("APK-versie, pakketnaam of Android-ondertekening klopt niet.")
                ui.post {
                    pendingInstall = apk
                    notify("installing", "Gecontroleerd. Bevestig de update in Android.", update.version, progress = 100)
                    openInstaller()
                }
            } catch (e: Exception) {
                tmp.delete()
                notify("error", "Bijwerken mislukt: ${e.message ?: "downloadfout"}")
            } finally { busy = false }
        }
    }

    private fun signingCerts(info: android.content.pm.PackageInfo): Array<Signature>? {
        return if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners
        else @Suppress("DEPRECATION") info.signatures
    }
    private fun fingerprint(signature: Signature): String =
        MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())
            .joinToString("") { "%02x".format(it.toInt() and 255) }

    private fun hasStableSignature(): Boolean = try {
        val flag = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
            else PackageManager.GET_SIGNATURES
        val info = activity.packageManager.getPackageInfo(activity.packageName, flag)
        signingCerts(info)?.any { fingerprint(it) == PINNED_CERT } ?: false
    } catch (_: Exception) { false }

    private fun isSameAppAndSigner(apk: File): Boolean = try {
        val flag = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
            else PackageManager.GET_SIGNATURES
        val pm = activity.packageManager
        val archive = pm.getPackageArchiveInfo(apk.absolutePath, flag) ?: return false
        if (archive.packageName != activity.packageName) return false
        val newCode = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        if (newCode <= versionCode()) return false
        val installed = pm.getPackageInfo(activity.packageName, flag)
        val oldCerts = signingCerts(installed) ?: return false
        val newCerts = signingCerts(archive) ?: return false
        newCerts.size == 1 && oldCerts.size == 1 &&
            fingerprint(newCerts[0]) == PINNED_CERT &&
            oldCerts[0].toByteArray().contentEquals(newCerts[0].toByteArray())
    } catch (_: Exception) { false }

    fun onResume() {
        if (Build.VERSION.SDK_INT >= 26 && pendingInstall != null &&
            activity.packageManager.canRequestPackageInstalls()) ui.post { openInstaller() }
    }

    private fun openInstaller() {
        val apk = pendingInstall ?: return
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            notify("permission", "Geef Schattepatatjes toestemming om de APK te installeren en ga terug.")
            try {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${activity.packageName}")))
            } catch (_: ActivityNotFoundException) {
                activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:${activity.packageName}")))
            }
            return
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            pendingInstall = null
            activity.startActivity(intent)
        } catch (e: Exception) {
            notify("error", "Android kon de installatie niet openen: ${e.message}")
        }
    }

    private fun readMetadata(url: String): String {
        val connection = connect(url)
        try {
            connection.inputStream.use { input ->
                val bytes = input.readNBytes(1024 * 1024 + 1)
                require(bytes.size <= 1024 * 1024) { "Release-informatie is te groot." }
                return String(bytes, Charsets.UTF_8)
            }
        } finally { connection.disconnect() }
    }

    private fun connect(address: String): HttpURLConnection {
        var current = URL(address)
        repeat(7) {
            require(current.protocol == "https") { "Updates vereisen HTTPS." }
            val host = current.host.lowercase(Locale.US)
            require(host == "api.github.com" || host == "github.com" ||
                    host == "release-assets.githubusercontent.com" || host == "objects.githubusercontent.com") {
                "Onverwachte updatehost."
            }
            val conn = (current.openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = 15000
                readTimeout = 30000
                setRequestProperty("User-Agent", "Schattepatatjes-Android-Updater")
                setRequestProperty("Accept", "application/vnd.github+json")
            }
            when (val status = conn.responseCode) {
                in 300..399 -> {
                    val dest = conn.getHeaderField("Location") ?: error("Doorverwijzing zonder adres.")
                    conn.disconnect()
                    current = URL(current, dest)
                }
                200 -> return conn
                else -> {
                    conn.disconnect()
                    if (status == 404) error("Er is nog geen GitHub Release gepubliceerd.")
                    error("GitHub geeft fout $status.")
                }
            }
        }
        error("Te veel doorverwijzingen bij downloaden.")
    }

    private fun compareVersions(a: String, b: String): Int {
        fun parts(v: String): List<Int> {
            val xs = v.split(".")
            require(xs.size in 2..3 && xs.all { it.matches(Regex("[0-9]{1,5}")) }) {
                "Ongeldig versienummer: $v"
            }
            return (xs + List(3 - xs.size) { "0" }).map { it.toInt() }
        }
        val first = parts(a)
        val second = parts(b)
        for (i in 0..2) if (first[i] != second[i]) return first[i].compareTo(second[i])
        return 0
    }

    private fun notify(status: String, message: String, version: String = "",
                       notes: String = "", progress: Int = 0) {
        val data = JSONObject().put("status", status).put("message", message)
            .put("version", version).put("notes", notes).put("progress", progress)
        ui.post { send(data) }
    }
}
