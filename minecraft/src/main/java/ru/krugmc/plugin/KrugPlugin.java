package ru.krugmc.plugin;

import org.bukkit.plugin.java.JavaPlugin;

/**
 * Плагин KRUG: подтверждение входа на сайт krugmc.ru командой /krug login.
 *
 * Сетевые запросы уходят в отдельном потоке: основной поток сервера
 * не должен ждать HTTP.
 */
public final class KrugPlugin extends JavaPlugin {

    private Messages messages;
    private SiteApi api;
    private String serverAddress = "";

    @Override
    public void onEnable() {
        saveDefaultConfig();
        reloadSettings();

        var command = getCommand("krug");
        if (command == null) {
            getLogger().severe("Команда /krug не зарегистрирована: проверь plugin.yml");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        var executor = new KrugCommand(this);
        command.setExecutor(executor);
        command.setTabCompleter(executor);

        if (!api.isConfigured()) {
            getLogger().warning("api.secret в config.yml не заполнен — вход работать не будет.");
        }
        getLogger().info("KRUG готов. Сайт: " + api.siteUrl());
    }

    @Override
    public void onDisable() {
        if (api != null) {
            api.shutdown();
        }
    }

    /** Перечитывает config.yml: вызывается при старте и по /krug reload. */
    public void reloadSettings() {
        reloadConfig();
        messages = new Messages(getConfig());
        serverAddress = getConfig().getString("server.address", "").trim();
        if (api != null) {
            api.shutdown();
        }
        api = new SiteApi(this);
    }

    public Messages messages() {
        return messages;
    }

    public SiteApi api() {
        return api;
    }

    /** Адрес подключения из config.yml: пустая строка, если не заполнен. */
    public String serverAddress() {
        return serverAddress;
    }
}
