package nl.mrtherich.schattepatatjes

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.TimeUnit
import javax.net.ssl.HttpsURLConnection

/** Best-effort background delivery without a Firebase account; Android controls the schedule. */
class FamilyNotifications(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val settings = applicationContext.getSharedPreferences("family-notifications", Context.MODE_PRIVATE)
        val profile = settings.getString("profile", null) ?: return Result.success()
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        val cookies = CookieManager.getInstance().getCookie("https://mrtherich.nl/sp/") ?: return Result.success()
        val connection = URL("https://mrtherich.nl/sp/api.php?action=foundation&route=notifications").openConnection() as HttpsURLConnection
        try {
            connection.connectTimeout = 10000
            connection.readTimeout = 15000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Cookie", cookies)
            if (connection.responseCode == 401) {
                settings.edit().remove("profile").apply()
                return Result.success()
            }
            if (connection.responseCode != 200) return Result.retry()
            val root = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val rows = root.getJSONObject("data").getJSONArray("notifications")
            val seen = (settings.getStringSet("seen-$profile", emptySet()) ?: emptySet()).toMutableSet()
            val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("family", "Gezinsmeldingen", NotificationManager.IMPORTANCE_DEFAULT))
            for (i in 0 until rows.length()) {
                val row = rows.getJSONObject(i)
                val id = row.getString("id")
                if (row.getString("recipientId") != profile || seen.contains(id)) continue
                val intent = Intent(applicationContext, MainActivity::class.java).putExtra("profile", profile).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                val pending = PendingIntent.getActivity(applicationContext, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val note = NotificationCompat.Builder(applicationContext, "family")
                    .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Schattepatatjes")
                    .setContentText(if (row.getString("type") == "krabbels") "Een nieuw krabbeltje voor jou" else "Een taak is aan jou toegewezen")
                    .setContentIntent(pending).setAutoCancel(true).build()
                NotificationManagerCompat.from(applicationContext).notify(id.hashCode(), note)
                seen.add(id)
            }
            val existing = (0 until rows.length()).map { rows.getJSONObject(it).getString("id") }.toSet()
            settings.edit().putStringSet("seen-$profile", seen.intersect(existing)).apply()
            return Result.success()
        } catch (_: Exception) { return Result.retry() }
        finally { connection.disconnect() }
    }
    companion object {
        fun enable(context: Context, profile: String) {
            if (!profile.matches(Regex("^[a-zA-Z0-9_-]{1,90}$"))) return
            context.getSharedPreferences("family-notifications", Context.MODE_PRIVATE).edit().putString("profile", profile).apply()
            CookieManager.getInstance().flush()
            val work = PeriodicWorkRequestBuilder<FamilyNotifications>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("family-notifications", ExistingPeriodicWorkPolicy.UPDATE, work)
        }
        fun disable(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork("family-notifications")
            context.getSharedPreferences("family-notifications", Context.MODE_PRIVATE).edit().remove("profile").apply()
            NotificationManagerCompat.from(context).cancelAll()
        }
    }
}
