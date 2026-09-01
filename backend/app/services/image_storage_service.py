"""Image storage service – compresses and uploads trip images to Supabase Storage.

Stores images as WebP in a per-trip folder structure:
  trip-images/{trip_id}/{item_type}/{item_id}.webp

Degrades gracefully: when Supabase credentials are missing, all operations
return None so the app keeps working via the existing proxy fallback.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

from flask import current_app

logger = logging.getLogger(__name__)

BUCKET_NAME = 'trip-images'
MAX_WIDTH = 640
MAX_WIDTH_HERO = 1600
WEBP_QUALITY = 60
WEBP_QUALITY_HERO = 72


def _get_supabase_client():
    url = current_app.config.get('SUPABASE_URL', '')
    key = current_app.config.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        logger.warning("Failed to create Supabase client: %s", exc)
        return None


def _compress_to_webp(image_bytes: bytes, max_width: int = MAX_WIDTH, quality: int | None = None) -> Optional[bytes]:
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')

        w, h = img.size
        if w > max_width:
            ratio = max_width / w
            img = img.resize((max_width, int(h * ratio)), Image.LANCZOS)

        webp_q = quality if quality is not None else (WEBP_QUALITY_HERO if max_width > MAX_WIDTH else WEBP_QUALITY)
        buf = io.BytesIO()
        img.save(buf, format='WEBP', quality=webp_q, method=4)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("WebP compression failed: %s", exc)
        return None


def upload_trip_image(
    trip_id: str,
    item_type: str,
    item_id: str,
    image_bytes: bytes,
    content_type: str = 'image/jpeg',
    max_width: int = MAX_WIDTH,
) -> Optional[str]:
    """Compress image to WebP and upload to Supabase Storage.

    Returns the public URL on success, None on failure or when Supabase
    is not configured.
    """
    client = _get_supabase_client()
    if not client:
        return None

    compressed = _compress_to_webp(image_bytes, max_width=max_width)
    if not compressed:
        return None

    path = f"{trip_id}/{item_type}/{item_id}.webp"
    try:
        client.storage.from_(BUCKET_NAME).upload(
            path,
            compressed,
            file_options={'content-type': 'image/webp', 'upsert': 'true'},
        )
        url = client.storage.from_(BUCKET_NAME).get_public_url(path)
        # Supabase SDK appends a bare '?' — strip it
        return url.rstrip('?') if url else url
    except Exception as exc:
        logger.warning("Supabase Storage upload failed for %s: %s", path, exc)
        return None


def delete_trip_images(trip_id: str) -> bool:
    """Delete all stored images for a trip."""
    client = _get_supabase_client()
    if not client:
        return False

    prefix = f"{trip_id}/"
    try:
        result = client.storage.from_(BUCKET_NAME).list(prefix)
        if not result:
            return True

        paths_to_delete = []
        for item_type_folder in result:
            folder_name = item_type_folder.get('name', '')
            if not folder_name:
                continue
            sub_path = f"{prefix}{folder_name}"
            sub_items = client.storage.from_(BUCKET_NAME).list(sub_path)
            for sub_item in (sub_items or []):
                file_name = sub_item.get('name', '')
                if file_name:
                    paths_to_delete.append(f"{sub_path}/{file_name}")

        if paths_to_delete:
            client.storage.from_(BUCKET_NAME).remove(paths_to_delete)
        return True
    except Exception as exc:
        logger.warning("Supabase Storage cleanup failed for trip %s: %s", trip_id, exc)
        return False
