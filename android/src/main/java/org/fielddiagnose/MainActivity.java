package org.fielddiagnose;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.location.Location;
import android.location.LocationManager;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.WindowInsets;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

/**
 * Offline shell: a WebView over the bundled assets. The diagnosis is fully offline.
 * INTERNET + COARSE location are used only by the opt-in "Use local weather" button.
 */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{ Manifest.permission.ACCESS_COARSE_LOCATION }, 42);

        web = new WebView(this);
        web.setBackgroundColor(0xFF111111);   // match the page bg so the inset strips aren't white
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // localStorage — remembers the last readings entered
        s.setAllowFileAccess(true);
        // The page is a bundled file:// asset; allow it to fetch api.weather.gov (NOAA sends CORS *).
        // Without this, a file:// origin can't make ANY cross-origin request and the fetch fails.
        // Safe here because ONLY our trusted bundled HTML loads — no remote or user-supplied content.
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setGeolocationEnabled(true);  // for the navigator.geolocation fallback (fresh fix)
        web.addJavascriptInterface(new PrintBridge(), "AndroidPrint");  // page -> Save-as-PDF report
        web.addJavascriptInterface(new GeoBridge(), "AndroidGeo");      // page -> last-known location
        // Grant the WebView's geolocation request (used only when last-known is empty).
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }
        });
        web.loadUrl("file:///android_asset/index.html");

        // API 35 forces edge-to-edge. Inset the content by the system bars so the title clears the
        // status-bar clock and the fixed button clears the nav bar. Pad a plain FrameLayout container,
        // NOT the WebView — WebView overrides onApplyWindowInsets and swallows a listener set on it.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF111111);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets b = insets.getInsets(WindowInsets.Type.systemBars());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsets.CONSUMED;
        });
        setContentView(root);
    }

    /** Exposes Android's print framework to the page so the service report can be saved as a PDF. */
    private class PrintBridge {
        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String job = "Field Diagnose report";
                PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(job);
                pm.print(job, adapter, new PrintAttributes.Builder().build());
            });
        }
    }

    /** Returns the freshest last-known location as "lat,lon" (or "") for the NOAA weather lookup. */
    private class GeoBridge {
        @JavascriptInterface
        public String getLocation() {
            try {
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    return "";
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                Location best = null;
                for (String p : lm.getProviders(true)) {
                    Location l = lm.getLastKnownLocation(p);
                    if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
                }
                return best == null ? "" : (best.getLatitude() + "," + best.getLongitude());
            } catch (Exception e) {
                return "";
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
