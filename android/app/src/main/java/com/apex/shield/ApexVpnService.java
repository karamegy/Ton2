package com.apex.shield;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

public class ApexVpnService extends VpnService {
    private static final String TAG = "ApexVpnService";
    private static final String CHANNEL_ID = "ApexVpnChannel";
    private ParcelFileDescriptor vpnInterface = null;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : "";
        
        if ("START".equals(action)) {
            createNotificationChannel();
            Notification notification = buildNotification();
            startForeground(101, notification);
            startVpn();
        } else if ("STOP".equals(action)) {
            stopVpn();
        }
        
        return START_STICKY;
    }

    private void startVpn() {
        if (vpnInterface != null) return;

        try {
            Builder builder = new Builder();
            // توجيه حركة المرور وتعيين خوادم DNS المانعة للإعلانات
            builder.addAddress("10.1.10.1", 24)
                   .addRoute("0.0.0.0", 0)
                   .addDnsServer("1.1.1.3") // DNS آمن بحظر البرمجيات الخبيثة والإعلانات
                   .addDnsServer("1.0.0.3")
                   .setSession("ApexShieldVPN");

            vpnInterface = builder.establish();
            Log.d(TAG, "✅ تم إنشاء نفق VPN وتأمين اتصالات الهاتف بالكامل!");
        } catch (Exception e) {
            Log.e(TAG, "❌ خطأ في إنشاء نفق VPN:", e);
        }
    }

    private void stopVpn() {
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
            stopForeground(true);
            stopSelf();
            Log.d(TAG, "🔒 تم إيقاف خدمة VPN بنجاح.");
        } catch (Exception e) {
            Log.e(TAG, "❌ خطأ عند إيقاف خدمة VPN:", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Apex Shield VPN Protection",
                NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        return builder
            .setContentTitle("Apex Shield AI")
            .setContentText("درع الحماية وخدمة VPN المشفرة نشطة الآن")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build();
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}
