# MediaAutoStart — OpenLP plugin

Forces every video/audio **media item** to start playing automatically whenever it
is sent live — from OpenLP's desktop UI **and** from remote controllers (like the
RESTv2 web remote in this repo).

## Why this exists

OpenLP only auto-plays a plain video (e.g. an MP4) when the service item's
`will_auto_start` flag is enabled. Normally that flag is flipped **per item** by
right-clicking the item in the Service Manager → **Auto Start → active**. There is no
global setting that does this for all media items. This plugin sets the flag on every
media item automatically, right before it is sent live, so no per-item clicking is
needed.

Only affects media (video/audio) items. Songs, images and presentations are untouched.

## Requirements

- OpenLP **3.1.6 or newer**. The autostart fix for plain videos landed in 3.1.6
  ("Fix media autostart behavior regarding video slide items"); on 3.1.5 this plugin
  alone will not make plain videos autostart.

## Installation

1. Create the plugin folder (the folder may not exist yet, create it):
   - **Windows**: `%APPDATA%\OpenLP\data\contrib\plugins\mediaautostart\`
     (usually `C:\Users\<YourUser>\AppData\Roaming\OpenLP\data\contrib\plugins\mediaautostart\`)
   - **Linux**: `~/.local/share/openlp/contrib/plugins/mediaautostart/`
   - **macOS**: `~/Library/Application Support/openlp/Data/contrib/plugins/mediaautostart/`
2. Copy `mediaautostartplugin.py` into that folder.
3. Restart OpenLP.
4. Confirm it is active:
   - **Tools → Plugins / Settings** should list **"Media Auto Start"** as installed/active.
   - If it does not appear, check the debug log (`OpenLP (Debug)` on Windows) for lines
     like `Hooked LiveController.add_service_manager_item for media auto-start`.

Done. Send any video live (from the web app or the desktop) and it will start playing
automatically.

## Notes

- The plugin is active even when it is not shown in the plugins list. There is no
  settings tab or Media Manager item.
- Because the plugin flips the flag for all media items, the Service Manager context
  menu entry will always show **"Auto Start - active"** once this plugin is installed.
- To revert everything to the old behaviour: delete the
  `mediaautostartplugin.py` file and restart OpenLP.

## How it works

OpenLP decides whether to autoplay media in
`openlp/core/ui/media/mediacontroller.py::decide_autoplay()`. For a plain video:

```python
will_autoplay_video = (service_item.requires_video() and setting==checked) or \
                      (service_item.will_auto_start and service_item.is_media())
```

`requires_video()` only covers *background* (theme) video, so the "Start Live items
automatically" setting does not affect plain media. This plugin sets
`service_item.will_auto_start = True` for media items inside the slide controller's
`add_service_manager_item()` / `add_service_item()` hooks — i.e. before the media
controller decides whether to play — which covers all send-live flows:

- Service items sent live (desktop and RESTv2 `POST /service/show`)
- Next/Previous navigation (`POST /service/progress`)
- Media-manager "send live" and plugin `POST /plugins/<plugin>/live`