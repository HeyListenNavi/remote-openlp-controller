# -*- coding: utf-8 -*-

##########################################################################
# MediaAutoStart - OpenLP community plugin                               #
# ---------------------------------------------------------------------- #
# Forces every video/audio media service item to start playing           #
# automatically whenever it is sent live, from the desktop UI as well as #
# from remote/web controllers (REST v2 API).                             #
#                                                                        #
# Why: OpenLP only auto-plays a plain video (MP4) item when the service  #
# item's ``will_auto_start`` flag is True. That flag defaults to False   #
# and is normally toggled per item via the Service Manager right-click   #
# menu ("Auto Start"). This plugin flips the flag for all media items    #
# automatically, so no per-item clicking is needed.                      #
#                                                                        #
# Requires OpenLP 3.1.6 or newer (the autostart fix for plain videos     #
# landed in 3.1.6, https://gitlab.com/openlp/openlp/-/releases).         #
##########################################################################

import logging

from openlp.core.common.enum import PluginStatus
from openlp.core.common.registry import Registry
from openlp.core.lib.plugin import Plugin, StringContent
from openlp.core.state import State

log = logging.getLogger(__name__)


def force_media_autostart(item):
    """
    Mark a service item to auto-start if it is a media item.

    :param ServiceItem | list | tuple | None item: The item (or items) being sent live.
    """
    items = item if isinstance(item, (list, tuple)) else [item]
    for media_item in items:
        if media_item is None:
            continue
        is_media = getattr(media_item, 'is_media', None)
        if is_media is not None and is_media():
            media_item.will_auto_start = True


class MediaAutoStartPlugin(Plugin):
    """
    Hooks the slide controllers so that media items are flagged ``will_auto_start``
    before OpenLP decides whether to start playing them.
    """
    log.info('MediaAutoStart plugin loaded')

    def __init__(self):
        super(MediaAutoStartPlugin, self).__init__('media_auto_start', version='1.0')
        self.weight = 100
        self.status = PluginStatus.Active
        State().add_service(self.name, self.weight, is_plugin=True)
        State().update_pre_conditions(self.name, self.check_pre_conditions())

    def set_plugin_text_strings(self):
        """
        Called by ``Plugin.__init__`` before ``name_strings`` is built. Without the
        ``Name`` entry OpenLP raises ``KeyError: 'name'`` at startup.
        """
        self.text_strings[StringContent.Name] = {
            'singular': 'Media Auto Start',
            'plural': 'Media Auto Start',
        }
        self.text_strings[StringContent.VisibleName] = {
            'title': 'Media Auto Start',
        }

    def check_pre_conditions(self):
        """This plugin has no dependencies."""
        return True

    def set_status(self):
        """This plugin must stay active for the hooks to be installed."""
        self.status = PluginStatus.Active

    def initialise(self):
        super(MediaAutoStartPlugin, self).initialise()
        self._hook_media_autostart()

    def app_startup(self):
        """Retry once the app is fully started in case a controller was not ready yet."""
        self._hook_media_autostart()

    def _hook_media_autostart(self):
        """
        Wrap the ``SlideController`` methods that load a service item so every media
        item is flagged to auto-start before the media controller decides whether to
        autoplay. Covers the "send live", "next/prev" and remote "show item" flows.
        """
        for controller_name in ('live_controller', 'preview_controller'):
            controller = Registry().get(controller_name)
            if controller is None:
                continue
            for method_name in ('add_service_manager_item', 'add_service_item'):
                self._wrap_controller_method(controller, method_name)

    def _wrap_controller_method(self, controller, method_name):
        original = getattr(controller, method_name, None)
        if original is None or getattr(original, '_mediaautostart_patched', False):
            return

        def wrapper(*args, **kwargs):
            if 'item' in kwargs:
                item = kwargs['item']
            elif args:
                item = args[0]
            else:
                item = None
            force_media_autostart(item)
            return original(*args, **kwargs)

        wrapper._mediaautostart_patched = True
        setattr(controller, method_name, wrapper)
        log.info('Hooked %s.%s for media auto-start', type(controller).__name__, method_name)