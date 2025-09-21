import os
from app import app
print('Flask url_map routes:')
for r in app.url_map.iter_rules():
    print(' ', r, '->', r.endpoint)
filename = '61347fc0-7b09-40d1-bb26-3a1da1a6ffae.jpeg'
full_path = os.path.join(app.root_path, 'images', filename)
print('\nApp root_path:', app.root_path)
print('Expected image path:', full_path)
print('Exists:', os.path.isfile(full_path))
