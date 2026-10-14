package io.github.karamegy.Ton2;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth; // إضافة استيراد بلجن جوجل

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // تسجيل بلجن المصادقة الأصلية لتجنب خطأ تسجيل الدخول في الـ APK
        registerPlugin(GoogleAuth.class);
    }
}
