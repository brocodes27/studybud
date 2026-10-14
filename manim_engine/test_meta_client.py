import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from meta_client import generate_text


class MetaClientTests(unittest.TestCase):
    @patch.dict('os.environ', {'MODEL_API_KEY': 'test-only'})
    @patch('meta_client.urlopen')
    def test_request_uses_contributor_and_parses_text(self, open_url):
        open_url.return_value = io.BytesIO(json.dumps({
            'choices': [{'finish_reason': 'stop', 'message': {'content': ' Animation code '}}]
        }).encode())
        self.assertEqual(generate_text('Explain gravity', json_output=True), 'Animation code')
        request = open_url.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.full_url, 'https://api.meta.ai/v1/chat/completions')
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-only')
        self.assertEqual(body['model'], 'muse-spark-1.3-contributor')
        self.assertEqual(body['response_format']['type'], 'json_schema')
        self.assertEqual(body['messages'][0]['content'], 'Explain gravity')

    @patch.dict('os.environ', {'MODEL_API_KEY': 'test-only'})
    @patch('meta_client.urlopen')
    def test_rejects_truncation_and_refusal(self, open_url):
        for choice in [
            {'finish_reason': 'length', 'message': {'content': '{}'}},
            {'message': {'refusal': 'Private data'}},
            {'message': {'content': ''}},
        ]:
            open_url.return_value = io.BytesIO(json.dumps({'choices': [choice]}).encode())
            with self.assertRaises(RuntimeError):
                generate_text('Test')

    @patch.dict('os.environ', {'MODEL_API_KEY': 'test-only'})
    @patch('meta_client.urlopen')
    def test_hides_provider_error_body(self, open_url):
        open_url.side_effect = HTTPError('https://api.meta.ai', 401, 'test-only', {}, None)
        with self.assertRaisesRegex(RuntimeError, '^Meta API error 401$'):
            generate_text('Test')

    @patch.dict('os.environ', {}, clear=True)
    def test_requires_server_key(self):
        with self.assertRaisesRegex(ValueError, 'MODEL_API_KEY'):
            generate_text('Test')
