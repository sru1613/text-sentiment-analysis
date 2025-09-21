from app import app

FILENAME = '61347fc0-7b09-40d1-bb26-3a1da1a6ffae.jpeg'

with app.test_client() as c:
    r = c.get(f'/images/{FILENAME}')
    print('Status:', r.status_code)
    print('Content-Length header:', r.headers.get('Content-Length'))
    print('First 32 bytes (hex):', r.data[:32].hex())
