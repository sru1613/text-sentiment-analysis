import json
import os
import sys
import importlib
import unittest

from flask import Flask

APP_MODULE_NAME = 'app'

# Ensure project root is on sys.path so 'app' can be imported when pytest is invoked
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

class SentimentAppBasicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Import the Flask app instance
        if APP_MODULE_NAME in globals():
            importlib.reload(globals()[APP_MODULE_NAME])
        cls.app_module = importlib.import_module(APP_MODULE_NAME)
        assert hasattr(cls.app_module, 'app'), 'Expected `app` Flask instance in app.py'
        cls.client = cls.app_module.app.test_client()

    def test_root_health(self):
        resp = self.client.get('/')
        self.assertIn(resp.status_code, (200, 302))  # Might redirect to login or show page

    def test_analyze_endpoint(self):
        payload = {"text": "I absolutely love this product! It works wonderfully."}
        resp = self.client.post('/analyze', json=payload)
        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json()
        self.assertIn('label', data)
        # App returns capitalized labels (Positive/Negative/Neutral)
        self.assertIn(data['label'], ('Positive', 'Negative', 'Neutral'))
        self.assertIn('scores', data)
        self.assertIn('compound', data['scores'])

    def test_chat_endpoint(self):
        # Chat likely requires tone; provide minimal payload
        resp = self.client.post('/chat', json={"message": "Hello there", "tone": "supportive"})
        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json()
        self.assertIn('reply', data)
        self.assertTrue(len(data['reply']) > 0)

if __name__ == '__main__':
    unittest.main()
