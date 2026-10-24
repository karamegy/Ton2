# قواعد عامة لـ Capacitor والمكتبات التابعة
-keep public class * extends android.webkit.WebViewClient
-keep public class * extends android.webkit.WebChromeClient

# الحفاظ على إعدادات Google Play Services و Firebase
-keep class com.google.android.gms.** { *; }
-include proguard-google-play-services.pro

# الحفاظ على موديولات Capacitor الأساسية
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# الحفاظ على إعدادات تسجيل الدخول بـ Google
-keep class com.codetrixstudio.capacitor.googleauth.** { *; }
-dontwarn com.codetrixstudio.capacitor.googleauth.**

# الحفاظ على النماذج والكلاسات الخاصة بتطبيقك (إذا لزم الأمر)
-keep class io.github.karamegy.Ton2.** { *; }
