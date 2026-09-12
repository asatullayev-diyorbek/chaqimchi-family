"""Premium (custom) emoji from Spino24's own pack: t.me/addemoji/pk_6402154_by_Ctikerubot

Telegram only renders a custom emoji inside message text/captions sent with
parse_mode="HTML", as a <tg-emoji emoji-id="..."> tag wrapping a regular
fallback emoji — the fallback is what non-Premium users actually see, so it
must always be a reasonable stand-in for the custom art. Button labels
(reply-keyboard, inline keyboard) don't support this — Telegram renders those
as plain text only.

Any message that uses `ce()` must be sent with parse_mode="HTML", and every
piece of dynamic text mixed into it (names, filenames, anything not written
by us) must go through `esc()` first so a stray "&"/"<"/">" can't break the
markup or be mistaken for a tag.
"""

import html

CUSTOM_EMOJI = {
    "wave": ("👋", "5267095699924757499"),
    "thumbsup": ("👍", "5267067318780865369"),
    "heart": ("❤️", "5267203855791209612"),
    "hug": ("🤗", "5267015603079651659"),
    "laptop": ("💻", "5267429487603132781"),
    "think": ("🤔", "5267170080168387284"),
    "party": ("🎉", "5267287547523934968"),
    "bulb": ("💡", "5267499654483848037"),
    "book": ("📚", "5267238872659569538"),
    "heart_eyes": ("😍", "5267457473610033185"),
    "sleepy": ("😴", "5267136854301386874"),
    "angry": ("😠", "5267516267417345789"),
    "shock": ("😱", "5267000523449476628"),
    "cool": ("😎", "5267298886237599719"),
    "laugh": ("😆", "5267234706541292232"),
    "lock": ("🔒", "5266994574919773254"),
    "eyes": ("👀", "5269737289495387506"),
    "dino1": ("🦖", "5267415090872755578"),
    "dino2": ("🦖", "5269482597934735109"),
    "dino3": ("🦖", "5267153437170115824"),
    "cool2": ("😎", "5266980886859001722"),
}


def ce(slug: str) -> str:
    """<tg-emoji> HTML tag for a custom emoji by slug (see CUSTOM_EMOJI)."""
    fallback, custom_emoji_id = CUSTOM_EMOJI[slug]
    return f'<tg-emoji emoji-id="{custom_emoji_id}">{fallback}</tg-emoji>'


def esc(text) -> str:
    """Escape dynamic text for safe use inside a parse_mode="HTML" message."""
    return html.escape(str(text), quote=False)
