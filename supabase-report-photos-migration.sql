-- Keep completion photos separate from order mockups/previews.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS report_photos TEXT[] NOT NULL DEFAULT '{}';

-- Older bot versions appended completion photos to image_urls.
UPDATE public.orders
SET report_photos = image_urls
WHERE status = 'completed'
  AND cardinality(report_photos) = 0
  AND cardinality(image_urls) > 0;
