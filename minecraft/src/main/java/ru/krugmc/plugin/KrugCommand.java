package ru.krugmc.plugin;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * /krug login <код> — подтвердить вход на сайт
 * /krug site        — ссылка на сайт
 * /krug ip          — адрес сервера из конфига
 * /krug reload      — перечитать config.yml (право krug.admin)
 */
public final class KrugCommand implements CommandExecutor, TabCompleter {

    private static final Pattern CODE = Pattern.compile("^[A-Z0-9]{6}$");

    private final KrugPlugin plugin;

    public KrugCommand(KrugPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command,
                             @NotNull String label, String[] args) {
        var messages = plugin.messages();

        if (args.length == 0) {
            sender.sendMessage(messages.get("usage"));
            return true;
        }

        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "reload" -> {
                if (!sender.hasPermission("krug.admin")) {
                    sender.sendMessage(messages.get("no-permission"));
                    return true;
                }
                plugin.reloadSettings();
                sender.sendMessage(plugin.messages().get("reloaded"));
                return true;
            }
            case "site", "link" -> {
                sender.sendMessage(messages.get("site", "%url%", plugin.api().siteUrl()));
                return true;
            }
            case "ip", "address" -> {
                var address = plugin.serverAddress();
                if (address.isEmpty()) {
                    sender.sendMessage(messages.get("address-unset"));
                } else {
                    sender.sendMessage(messages.get("address", "%address%", address));
                }
                return true;
            }
            case "login" -> {
                handleLogin(sender, args);
                return true;
            }
            default -> {
                sender.sendMessage(messages.get("usage"));
                return true;
            }
        }
    }

    private void handleLogin(CommandSender sender, String[] args) {
        var messages = plugin.messages();

        if (!(sender instanceof Player player)) {
            sender.sendMessage(messages.get("players-only"));
            return;
        }
        if (!plugin.api().isConfigured()) {
            player.sendMessage(messages.get("bad-config"));
            return;
        }
        if (args.length < 2) {
            player.sendMessage(messages.get("usage"));
            return;
        }

        var code = args[1].trim().toUpperCase(Locale.ROOT);
        if (!CODE.matcher(code).matches()) {
            player.sendMessage(messages.get("code-format"));
            return;
        }

        player.sendMessage(messages.get("wait"));

        var textures = readTextures(player);
        var uuid = player.getUniqueId().toString();
        var nickname = player.getName();

        plugin.api().confirmLogin(code, uuid, nickname, textures).thenAccept(result -> {
            // Ответ пришёл в сетевом потоке — сообщение шлём из основного.
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                if (!player.isOnline()) {
                    return;
                }
                var msg = plugin.messages();
                if (result.ok()) {
                    player.sendMessage(msg.get("success"));
                    return;
                }
                player.sendMessage(switch (String.valueOf(result.error())) {
                    case "code_not_found" -> msg.get("code-not-found");
                    case "code_expired" -> msg.get("code-expired");
                    case "too_many_attempts", "rate_limited" -> msg.get("too-many");
                    case "site_unavailable", "bad_response" -> msg.get("site-unavailable");
                    default -> result.message() != null
                            ? msg.get("code-not-found")
                            : msg.get("site-unavailable");
                });
            });
        });
    }

    /**
     * Значение textures из профиля игрока: сайт сам вырежет из скина голову.
     * Сервер лицензионный, профиль приходит от Mojang вместе с входом.
     */
    private String readTextures(Player player) {
        try {
            return player.getPlayerProfile().getProperties().stream()
                    .filter(property -> property.getName().equals("textures"))
                    .map(property -> property.getValue())
                    .findFirst()
                    .orElse(null);
        } catch (RuntimeException error) {
            plugin.getLogger().warning("Не удалось прочитать скин игрока " + player.getName());
            return null;
        }
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command,
                                                @NotNull String label, String[] args) {
        if (args.length == 1) {
            var options = new ArrayList<String>();
            options.add("login");
            options.add("site");
            options.add("ip");
            if (sender.hasPermission("krug.admin")) {
                options.add("reload");
            }
            var typed = args[0].toLowerCase(Locale.ROOT);
            options.removeIf(option -> !option.startsWith(typed));
            return options;
        }
        return List.of();
    }
}
