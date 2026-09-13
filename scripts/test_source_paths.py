#!/usr/bin/env python3
"""Host-independent source remapping and lazy texture discovery contracts."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from btlib.source_paths import resolve_source_blend
from btlib.texture_paths import LazyTextureIndex


class SourcePathTests(unittest.TestCase):
    def test_existing_and_relative_sources_win_over_remaps(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "asset.blend"
            source.touch()
            with patch.dict(os.environ, {"BT_SOURCE_BLEND_MAP": f"{root}=/missing"}):
                self.assertEqual(resolve_source_blend(source), source)
                self.assertEqual(resolve_source_blend("asset.blend", root), source)

    def test_prefix_remap_obeys_directory_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "asset.blend"
            source.touch()
            with patch.dict(os.environ, {"BT_SOURCE_BLEND_MAP": f"/absent/source={root}"}):
                self.assertEqual(resolve_source_blend("/absent/source/asset.blend"), source)
                raw = "/absent/source-other/asset.blend"
                self.assertEqual(resolve_source_blend(raw), Path(raw))

    def test_menagerie_fallback_and_missing_source(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            source = home / "asset-menagerie" / "nested" / "asset.blend"
            source.parent.mkdir(parents=True)
            source.touch()
            with (
                patch("pathlib.Path.home", return_value=home),
                patch.dict(os.environ, {"BT_SOURCE_BLEND_MAP": ""}),
            ):
                self.assertEqual(
                    resolve_source_blend("/absent/asset-menagerie/nested/asset.blend"), source
                )
                raw = "/absent/asset-menagerie/missing.blend"
                self.assertEqual(resolve_source_blend(raw), Path(raw))

    def test_texture_index_scans_only_on_first_missing_image_lookup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "texture.png"
            index = LazyTextureIndex([root])
            self.assertFalse(index.scanned)
            image.touch()
            self.assertEqual(index.get("texture.png"), [image])
            self.assertTrue(index.scanned)
            with patch("btlib.texture_paths.index_texture_basenames", side_effect=AssertionError):
                self.assertEqual(index.get("texture.png"), [image])
                self.assertEqual(index.get("missing.png", []), [])


if __name__ == "__main__":
    unittest.main()
