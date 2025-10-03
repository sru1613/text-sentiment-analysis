import pytest
import json
from app import app


def test_analyze_returns_keys_and_emoji():
    """POST /analyze should return JSON with label, scores, and emoji.

    Note: on Windows consoles printing emoji can raise a UnicodeEncodeError when
    writing to stdout. This test inspects the response bytes decoded as utf-8
    and also checks the presence of the emoji codepoint in the decoded string.
    """
    client = app.test_client()
    payload = {"text": "I absolutely love this product! It works wonderfully."}
    resp = client.post('/analyze', json=payload)
    assert resp.status_code == 200
    # Check raw bytes decode as utf-8 (server configured JSON_AS_ASCII=False)
    raw = resp.get_data()
    decoded = raw.decode('utf-8')
    assert 'label' in decoded
    assert 'scores' in decoded
    # emoji should be present as a unicode character (e.g. 😊) or as an escaped sequence ("\\uXXXX")
    has_escaped = '\\u' in decoded
    has_high_cp = any(ord(ch) >= 0x1F300 for ch in decoded)
    assert has_escaped or has_high_cp
    # Also verify the parsed JSON contains expected keys
    data = json.loads(decoded)
    assert 'label' in data
    assert 'scores' in data and isinstance(data['scores'], dict)
    # compound should be present inside scores
    assert 'compound' in data['scores']
