package ru.krugmc.plugin;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.HashMap;
import java.util.Map;

/**
 * Тексты из config.yml. Формат MiniMessage (Adventure), устаревший ChatColor
 * не используется.
 */
public final class Messages {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final Map<String, String> values = new HashMap<>();
    private final String prefix;

    public Messages(FileConfiguration config) {
        var section = config.getConfigurationSection("messages");
        if (section != null) {
            for (var key : section.getKeys(false)) {
                values.put(key, section.getString(key, ""));
            }
        }
        prefix = values.getOrDefault("prefix", "");
    }

    public Component get(String key) {
        return MINI.deserialize(prefix + values.getOrDefault(key, key));
    }

    public Component get(String key, String placeholder, String replacement) {
        var raw = values.getOrDefault(key, key).replace(placeholder, replacement);
        return MINI.deserialize(prefix + raw);
    }

    /** Текст без префикса — для строк внутри других сообщений. */
    public String raw(String key) {
        return values.getOrDefault(key, key);
    }
}
