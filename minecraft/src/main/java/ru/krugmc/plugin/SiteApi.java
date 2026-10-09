package ru.krugmc.plugin;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Обращения к сайту. Каждый запрос подписан HMAC-SHA256 по строке
 *   <timestamp>.<nonce>.<тело>
 * Тот же формат использует Telegram-бот, описание — в API.md.
 */
public final class SiteApi {

    private final KrugPlugin plugin;
    private final String url;
    private final String secret;
    private final Duration timeout;
    private final HttpClient http;
    private final ExecutorService pool;
    private final SecureRandom random = new SecureRandom();

    public SiteApi(KrugPlugin plugin) {
        this.plugin = plugin;
        var config = plugin.getConfig();
        this.url = stripSlash(config.getString("api.url", "https://krugmc.ru"));
        this.secret = config.getString("api.secret", "");
        this.timeout = Duration.ofSeconds(Math.max(3, config.getInt("api.timeout-seconds", 10)));
        this.pool = Executors.newVirtualThreadPerTaskExecutor();
        this.http = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .executor(pool)
                .build();
    }

    public boolean isConfigured() {
        return secret != null && secret.length() >= 32 && !secret.equals("CHANGE_ME");
    }

    public String siteUrl() {
        return url;
    }

    public record Result(boolean ok, String error, String message) {
    }

    /**
     * Подтверждение входа. Вызывается из асинхронного потока,
     * результат обрабатывается вызывающей стороной.
     */
    public CompletableFuture<Result> confirmLogin(String code, String uuid, String nickname, String textures) {
        var body = new JsonObject();
        body.addProperty("code", code);
        body.addProperty("uuid", uuid);
        body.addProperty("nickname", nickname);
        if (textures != null && !textures.isBlank()) {
            body.addProperty("textures", textures);
        }
        var payload = body.toString();

        var timestamp = String.valueOf(System.currentTimeMillis() / 1000L);
        var nonce = randomHex();
        var signature = sign(timestamp + "." + nonce + "." + payload);

        var request = HttpRequest.newBuilder(URI.create(url + "/api/plugin/mc-login"))
                .timeout(timeout)
                .header("Content-Type", "application/json; charset=utf-8")
                .header("X-KRUG-Timestamp", timestamp)
                .header("X-KRUG-Nonce", nonce)
                .header("X-KRUG-Signature", signature)
                .header("User-Agent", "KRUG-Plugin/" + plugin.getPluginMeta().getVersion())
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();

        return http.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .thenApply(this::toResult)
                .exceptionally(error -> {
                    plugin.getLogger().warning("Сайт недоступен: " + error.getMessage());
                    return new Result(false, "site_unavailable", null);
                });
    }

    private Result toResult(HttpResponse<String> response) {
        try {
            var json = JsonParser.parseString(response.body()).getAsJsonObject();
            var ok = json.has("ok") && json.get("ok").getAsBoolean();
            var error = json.has("error") ? json.get("error").getAsString() : null;
            var message = json.has("message") ? json.get("message").getAsString() : null;
            return new Result(ok, error, message);
        } catch (RuntimeException parseError) {
            plugin.getLogger().warning("Непонятный ответ сайта (" + response.statusCode() + ")");
            return new Result(false, "bad_response", null);
        }
    }

    private String sign(String data) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("Не удалось подписать запрос", error);
        }
    }

    private String randomHex() {
        var bytes = new byte[16];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String stripSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    public void shutdown() {
        pool.shutdown();
    }
}
