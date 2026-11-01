// JavaScript / scripts/plasma/klaus-layout.js / KDE Plasma 6 shell / DISPLAY=:3
// This layout preserves every existing panel, applet, launcher and desktop icon.
// __WALLPAPER_URI__ is replaced with a JSON-quoted local file URL at application time.
(function () {
    var wallpaper = __WALLPAPER_URI__;
    var ds = desktops();
    for (var d = 0; d < ds.length; d++) {
        var desktop = ds[d];
        desktop.wallpaperPlugin = "org.kde.image";
        desktop.currentConfigGroup = ["Wallpaper", "org.kde.image", "General"];
        desktop.writeConfig("Image", wallpaper);
        desktop.writeConfig("FillMode", 2);
        desktop.reloadConfig();
    }

    var ps = panels();
    if (!ps.length) {
        throw new Error("Nenhum painel KDE detectado. O layout original foi mantido.");
    }
    var p = ps[0];
    for (var n = 0; n < ps.length; n++) {
        if (ps[n].location === "bottom") {
            p = ps[n];
            break;
        }
    }

    p.location = "bottom";
    p.lengthMode = "fill";
    p.height = 54;
    p.hiding = "none";
    p.alignment = "center";

    // Keep every original widget. Only move them around inside the existing panel.
    var ww = p.widgets();
    var start = [];
    var quick = [];
    var tasks = [];
    var right = [];
    var extra = [];
    var spacers = [];
    for (var i = 0; i < ww.length; i++) {
        var w = ww[i];
        var t = w.type;
        if (t === "org.kde.plasma.panelspacer") {
            spacers.push(w);
        } else if (t === "org.kde.plasma.kickoff" || t === "org.kde.plasma.kicker" || t === "org.kde.plasma.kickerdash") {
            start.push(w);
        } else if (t === "org.kde.plasma.quicklaunch" || t === "org.kde.plasma.taskmanager") {
            quick.push(w);
        } else if (t === "org.kde.plasma.icontasks") {
            tasks.push(w);
        } else if (t === "org.kde.plasma.systemtray" || t === "org.kde.plasma.digitalclock" || t === "org.kde.plasma.showdesktop") {
            right.push(w);
        } else {
            extra.push(w);
        }
    }

    // One expanding spacer on each side centers the launcher/task icons.
    if (knownWidgetTypes.indexOf("org.kde.plasma.panelspacer") !== -1) {
        while (spacers.length < 2) {
            spacers.push(p.addWidget("org.kde.plasma.panelspacer"));
        }
        for (var s = 0; s < 2; s++) {
            spacers[s].currentConfigGroup = ["Configuration", "General"];
            spacers[s].writeConfig("expanding", true);
        }
        var items = [spacers[0]];
        items = items.concat(start, quick, tasks, extra, [spacers[1]], right);
        if (spacers.length > 2) {
            items = items.concat(spacers.slice(2));
        }
        // Write indexes starting from 0, never remove or re-create an existing widget.
        for (var j = 0; j < items.length; j++) {
            items[j].index = j;
        }
    }

    for (var c = 0; c < right.length; c++) {
        if (right[c].type === "org.kde.plasma.digitalclock") {
            right[c].currentConfigGroup = ["Appearance"];
            right[c].writeConfig("showDate", true);
            right[c].reloadConfig();
        }
    }
    print("KLAUS_LAYOUT_OK: desktops=" + ds.length + ", panel=" + p.id + ", widgets=" + p.widgets().length);
})();
