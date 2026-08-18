import unittest
from prepare_photos import target_size


class TargetSizeTest(unittest.TestCase):
    def test_downscales_by_longest_side(self):
        self.assertEqual(target_size(3000, 4500), (1067, 1600))

    def test_keeps_small_images_untouched(self):
        self.assertEqual(target_size(800, 1200), (800, 1200))

    def test_handles_landscape(self):
        self.assertEqual(target_size(6000, 4000), (1600, 1067))

    def test_never_returns_zero(self):
        self.assertEqual(target_size(1, 4000), (1, 1600))


if __name__ == "__main__":
    unittest.main()
