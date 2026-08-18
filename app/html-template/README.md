# HTML template contract

The template library discovers every pair of files matching:

```text
<name>.html
<name>.manifest.json
```

No React component or route change is required when adding another pair.

## HTML values

Use escaped `{{fieldKey}}` tokens directly in the HTML file:

```html
<div class="product-number">{{productNumber}}</div>
<div class="width-value">{{width}}</div>
```

Units, labels, layout, and styling remain ordinary HTML/CSS:

```html
<div class="thickness-value">
  {{thickness}} <span class="unit">μm</span>
</div>
```

User-entered values are HTML-escaped before rendering. Unknown tokens fail the
build instead of silently rendering incorrect output.

## Manifest

The adjacent manifest supplies dashboard metadata, canvas dimensions, zoom
defaults, and the field groups used by the editor:

```json
{
  "schemaVersion": 1,
  "id": "example-label",
  "name": "Example label",
  "description": "Example product label",
  "category": "Product label",
  "canvas": { "width": 1032, "height": 1192 },
  "thumbnailScale": 0.2,
  "builderScale": 0.58,
  "fieldGroups": [
    {
      "title": "Product",
      "fields": [
        {
          "key": "productNumber",
          "label": "Product number",
          "type": "text",
          "default": "ABC-001"
        }
      ]
    }
  ]
}
```

Supported field types are `text`, `number`, `date`, and `textarea`. Fields can
also define `unit`, `placeholder`, and `step`.

Increment `schemaVersion` after changing field keys or defaults. Saved browser
values are versioned with it.

## Assets

Put template images under `assets/` and reference them relatively:

```html
<img src="assets/example/logo.png" alt="Company logo" />
```

The server-side template library resolves these paths through Vite. Missing
asset references fail fast during development and production builds.
