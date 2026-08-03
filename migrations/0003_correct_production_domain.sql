UPDATE products
SET data = json_set(data, '$.liveUrl', 'https://kokage-studio.com'),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'portfolio-site'
  AND json_extract(data, '$.liveUrl') = 'https://kokage-stuidio.com';
