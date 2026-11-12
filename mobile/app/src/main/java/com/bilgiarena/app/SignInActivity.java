package com.bilgiarena.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/** Top-level Site sign-in, not a second OAuth implementation. Cookies stay in app-private storage. */
public final class SignInActivity extends SecureActivity {
    private WebView web;
    private ArenaApi api;
    private boolean checking;
    private TextView status;
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        api = new ArenaApi(this);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(0xffa0d3d7); layout.setFitsSystemWindows(true);
        Button close = new Button(this); close.setText("‹  BilgiArena'ya dön"); close.setAllCaps(false);
        close.setOnClickListener(v -> finish()); layout.addView(close);
        status = new TextView(this); status.setPadding(24,12,24,16);
        status.setText("BilgiArena hesabını bağla. Giriş tamamlandığında uygulamaya döneceksin.");
        layout.addView(status);
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setFilterTouchesWhenObscured(true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (allowed(uri)) return false;
                status.setText("Bu giriş sağlayıcısı harici tarayıcı istiyor. E-posta ile giriş yöntemini kullanabilir veya geri dönebilirsin.");
                return true;
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); status.setText("Güvenli bağlantı doğrulanamadı. Tarih ve internet bağlantını kontrol et.");
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) status.setText("Giriş sayfası yüklenemedi. İnternet bağlantını kontrol et ve yeniden dene.");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!Uri.parse(BuildConfig.ARENA_ORIGIN).getHost().equals(Uri.parse(url).getHost()) || checking) return;
                checking = true;
                CookieManager.getInstance().flush();
                api.getAccount((result,error) -> {
                    checking = false;
                    if (error == null) { setResult(RESULT_OK); finish(); }
                });
            }
        });
        layout.addView(web,new LinearLayout.LayoutParams(-1,0,1)); setContentView(layout);
        web.loadUrl(BuildConfig.ARENA_ORIGIN+"/signin-with-chatgpt?return_to=%2F");
    }
    static boolean allowed(Uri uri) {
        if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
        String host = uri.getHost();
        return host != null && (host.equals(Uri.parse(BuildConfig.ARENA_ORIGIN).getHost()) || host.equals("chatgpt.com")
            || host.equals("auth.openai.com") || host.equals("auth0.openai.com"));
    }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (api != null) api.close(); if (web != null) { web.stopLoading(); web.destroy(); } super.onDestroy();
    }
}
