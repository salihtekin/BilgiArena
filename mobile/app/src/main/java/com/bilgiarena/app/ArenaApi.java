package com.bilgiarena.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import com.google.android.gms.tasks.Tasks;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.StandardIntegrityManager;
import org.json.JSONObject;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Uses the Site's own signed-in session. No identity header, shared token or secret in the APK. */
public final class ArenaApi {
    public interface Callback { void done(JSONObject result, Exception error); }
    public static final class ApiException extends Exception {
        public final int status;
        ApiException(int status, String message) { super(message); this.status = status; }
    }
    private final Context context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService readers = Executors.newFixedThreadPool(2);
    private JSONObject securityConfig;private long securityAt;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final java.util.Map<String,String> roundAccess = new java.util.concurrent.ConcurrentHashMap<>();
    private StandardIntegrityManager.StandardIntegrityTokenProvider provider;
    private long providerProject;
    private volatile boolean closed;

    public ArenaApi(Context context) { this.context = context.getApplicationContext(); }
    public void get(String query, Callback callback) { enqueue(null, query, "/api/arena", callback); }
    public void post(JSONObject body, Callback callback) { enqueue(body, "", "/api/arena", callback); }
    public void getAccount(Callback callback) { enqueue(null, "", "/api/account", callback); }
    public void postAccount(JSONObject body, Callback callback) { enqueue(body, "", "/api/account", callback); }
    public void getPlayer(int page,Callback cb){enqueue(null,"?page="+page,"/api/player",cb);}
    public void postPlayer(JSONObject body,Callback cb){enqueue(body,"","/api/player",cb);}
    public void getWallet(Callback cb) { enqueue(null,"","/api/wallet",cb); }
    public void postWallet(JSONObject body,Callback cb) { enqueue(body,"","/api/wallet",cb); }
    public void getCompetitions(String query,Callback cb) { enqueue(null,query,"/api/competition",cb); }
    public void postCompetition(JSONObject body,Callback cb) { enqueue(body,"","/api/competition",cb); }
    public void close() { closed = true; worker.shutdownNow(); readers.shutdownNow(); }
    private synchronized JSONObject security() throws Exception {long now=android.os.SystemClock.elapsedRealtime();if(securityConfig==null||now-securityAt>120000){securityConfig=request(null,"?security=1",Map.of());securityAt=now;}return securityConfig;}
    private void enqueue(JSONObject body, String query, String path, Callback callback) {
        if (closed) return;
        (body==null?readers:worker).execute(() -> {
            JSONObject result = null; Exception error = null;
            try {
                Map<String,String> extra = Map.of();
                String raw = body == null ? null : body.toString();
                String action = body == null ? "" : body.optString("action");
                if (body != null && (path.equals("/api/competition") || path.equals("/api/arena") && (action.equals("start") || action.equals("answer") || action.equals("next") || action.equals("resume") || action.equals("interrupt")))) {
                    String access=roundAccess.get(body.optString("roundId"));boolean readGrant=path.equals("/api/arena")&&(action.equals("next")||action.equals("resume"))&&access!=null;
                    JSONObject config = security();
                    if(readGrant)extra=Map.of("X-Arena-Round-Access",access);
                    boolean localPractice = action.equals("start") && body.optString("mode").equals("practice");
                    if (config.optBoolean("integrityRequired") && !localPractice && !readGrant) {
                        long project = config.optLong("cloudProjectNumber");
                        if (project <= 0) throw new ApiException(503,"Cihaz doğrulaması henüz yapılandırılmadı.");
                        JSONObject challengeBody = new JSONObject().put("action","integrity-challenge").put("payload",raw);
                        JSONObject challenge = request(challengeBody.toString(), "", Map.of());
                        if (provider == null || providerProject != project) {
                            provider = Tasks.await(IntegrityManagerFactory.createStandard(context).prepareIntegrityToken(
                                StandardIntegrityManager.PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(project).build()), 45, TimeUnit.SECONDS);
                            providerProject = project;
                        }
                        String token;
                        try {
                            token = Tasks.await(provider.request(StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
                                .setRequestHash(challenge.getString("requestHash")).build()), 25, TimeUnit.SECONDS).token();
                        } catch (Exception e) {
                            provider = null;
                            throw new ApiException(403,"Google Play cihaz doğrulaması tamamlanamadı. Resmî test sürümünü ve Google Play hizmetlerini kontrol et.");
                        }
                        extra = Map.of("X-Arena-Challenge",challenge.getString("id"),"X-Arena-Integrity-Token",token);
                    }
                }
                result = request(raw, query, extra, path);
                if(result.has("accessToken"))roundAccess.put(result.getString("id"),result.getString("accessToken"));
            } catch (Exception e) {if(body!=null&&e instanceof ApiException&&(((ApiException)e).status==403||((ApiException)e).status==428)){roundAccess.remove(body.optString("roundId"));synchronized(this){securityConfig=null;}}error = e; }
            JSONObject value = result; Exception failure = error;
            ui.post(() -> { if (!closed) callback.done(value, failure); });
        });
    }
    private JSONObject request(String body, String query, Map<String,String> extra) throws Exception {
        return request(body,query,extra,"/api/arena");
    }
    private JSONObject request(String body, String query, Map<String,String> extra, String path) throws Exception {
        if (!query.isEmpty() && !query.startsWith("?")) throw new IllegalArgumentException("query");
        URL url = new URL(BuildConfig.ARENA_ORIGIN+path+query);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("X-Arena-Version",String.valueOf(BuildConfig.VERSION_CODE));
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(18_000);
        connection.setRequestProperty("Accept","application/json");
        connection.setRequestProperty("Cache-Control","no-store");
        String cookies = CookieManager.getInstance().getCookie(BuildConfig.ARENA_ORIGIN);
        if (cookies != null) connection.setRequestProperty("Cookie",cookies);
        for (Map.Entry<String,String> entry : extra.entrySet()) connection.setRequestProperty(entry.getKey(),entry.getValue());
        if (body != null) {
            connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
            connection.setRequestProperty("Origin",BuildConfig.ARENA_ORIGIN);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (var output = connection.getOutputStream()) { output.write(bytes); }
        }
        try {
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new ApiException(401,"Hesabını bağlamak için giriş yap.");
            String type = connection.getContentType();
            if (type == null || !type.contains("application/json")) throw new ApiException(401,"Hesabını bağlamak için giriş yap.");
            try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
                if (input == null) throw new ApiException(status,"Sunucuya ulaşılamadı.");
                java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                byte[] chunk = new byte[8192]; int count;
                while ((count=input.read(chunk)) != -1) {
                    if (buffer.size()+count>512_000) throw new ApiException(502,"Sunucu yanıtı çok büyük.");
                    buffer.write(chunk,0,count);
                }
                byte[] bytes = buffer.toByteArray();
                JSONObject json = new JSONObject(new String(bytes,StandardCharsets.UTF_8));
                if (status >= 400) throw new ApiException(status,json.optString("error","İstek tamamlanamadı."));
                return json;
            }
        } finally { connection.disconnect(); }
    }
    public static JSONObject body(String action, Object... values) {
        JSONObject result = new JSONObject();
        try {
            result.put("action",action);
            for (int i=0; i<values.length; i+=2) result.put((String)values[i],values[i+1] == null ? JSONObject.NULL : values[i+1]);
        } catch (org.json.JSONException e) { throw new IllegalArgumentException(e); }
        return result;
    }
}
