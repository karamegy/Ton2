# 1. الحفاظ على الجسر بين JavaScript و Android Native في Capacitor
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 2. إعدادات WebView القياسية
-keep public class * extends android.webkit.WebViewClient
-keep public class * extends android.webkit.WebChromeClient

# 3. الحفاظ على موديولات Capacitor الأساسية وجميع الإضافات
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# 4. الحفاظ على إعدادات تسجيل الدخول بـ Google
-keep class com.codetrixstudio.capacitor.googleauth.** { *; }
-dontwarn com.codetrixstudio.capacitor.googleauth.**

# 5. الحفاظ على خدمات Google Play و Firebase
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# 6. الحفاظ على كلاسات التطبيق الخاصة بك
-keep class io.github.karamegy.Ton2.** { *; }
-dontwarn io.github.karamegy.Ton2.**

# 7. الحفاظ على الدوال النيتف والـ Enums لتجنب انهيار التطبيق أثناء التشغيل
-keepclasseswithmembernames class * {
    native <methods>;
}
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
