package com.crititrack.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createAlertChannel()
    }

    /**
     * Android 8 and above drop any notification whose channel does not
     * exist, silently and with nothing in logcat, so this is the single
     * most likely reason for "the push is accepted but never appears".
     *
     * The id must match the channelId the server sets in
     * functions/lib/push.js. The channel is created explicitly rather
     * than relying on the messaging SDK's default-channel fallback,
     * because that fallback applies only to messages which do not name a
     * channel — and ours does.
     *
     * Creating a channel that already exists is a no-op, except that the
     * name and description are refreshed; importance is not, since the
     * user may have lowered it deliberately.
     */
    private fun createAlertChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            "crititrack_alerts",
            "Sentiment alerts",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description =
                "When a figure you follow moves sharply against their " +
                "own recent average."
        }

        getSystemService(NotificationManager::class.java)
            ?.createNotificationChannel(channel)
    }
}
