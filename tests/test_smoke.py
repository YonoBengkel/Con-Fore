import os
import socket
import unittest
from unittest import mock

from confore import smoke

FRED = next(item for item in smoke.CHECKS if item[0] == "FRED")
BPS = next(item for item in smoke.CHECKS if item[0] == "BPS")


class SmokeTest(unittest.TestCase):
    def test_key_with_space_is_rejected_without_echo(self):
        with mock.patch.dict(os.environ, {"FRED_API_KEY": "FAKE KEY123"}):
            name, result, note, _ = smoke.check(*FRED)
        self.assertEqual(result, "gagal")
        self.assertNotIn("KEY123", note)

    def test_network_error_note_has_no_key(self):
        failure = OSError("connect failed for /key/FAKEKEY123")
        with mock.patch.dict(os.environ, {"BPS_API_KEY": "FAKEKEY123"}), \
                mock.patch.object(socket, "create_connection", side_effect=failure):
            name, result, note, _ = smoke.check(*BPS)
        self.assertEqual(result, "gagal")
        self.assertNotIn("FAKEKEY123", note)

    def test_csv_without_observation_value_fails(self):
        self.assertFalse(smoke.has_obs("COUNTRY,TIME_PERIOD,OBS_VALUE\nIDN,,\n"))
        self.assertTrue(smoke.has_obs("COUNTRY,TIME_PERIOD,OBS_VALUE\nIDN,2025,5.1\n"))


if __name__ == "__main__":
    unittest.main()
