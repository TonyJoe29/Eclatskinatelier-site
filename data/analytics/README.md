# Base de datos inicial

Estos CSV son simples a proposito para poder moverlos despues a Google Sheets, Airtable, Notion, Looker Studio, Power BI, Tableau o una base SQL pequena.

## Archivos

- `products.csv`: un renglon por producto activo, planeado o en banco.
- `social-posts.csv`: un renglon por Pin, Reel, carrusel o set de Stories.
- `channel-daily-metrics.csv`: foto diaria de cada cuenta.

## Rutina diaria

1. Registra cada Reel y Pin en `social-posts.csv`.
2. Al final del dia, agrega metricas de cuenta en `channel-daily-metrics.csv`.
3. Cada domingo, compara productos por impresiones, saves, outbound clicks y affiliate clicks.
4. Sube prioridad a productos que ganen en saves y clicks, no solo en views.

## Metricas para agregar despues

- Instagram: plays, reach, likes, comments, saves, shares y profile visits.
- Pinterest: impressions, saves, pin clicks y outbound clicks.
- Amazon Associates: clicks, ordered items, shipped revenue y commission.
- Sitio web: clicks por producto desde Netlify, Plausible, GA4 o el dashboard de afiliados.
