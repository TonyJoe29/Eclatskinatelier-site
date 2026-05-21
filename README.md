# EclatSkinAtelier Site

Carpeta dedicada para publicar y operar la pagina de EclatSkinAtelier.

## Estructura

- `index.html`: pagina estatica lista para subir.
- `assets/`: imagenes propias, screenshots permitidos, logos y recursos visuales.
- `docs/`: estrategia, SEO, calendario y guias de publicacion.
- `data/`: listas de productos y pipeline de contenido.
- `drafts/`: captions, guiones y borradores semanales.
- `videos/`: material de referencia local. Esta carpeta esta ignorada por Git para no subir videos pesados o material no listo para publicar.

## Publicacion gratis recomendada

La forma mas rapida es Netlify Drop:

1. Entra a `https://app.netlify.com/drop`.
2. Arrastra esta carpeta completa: `EclatSkinAtelier-site`.
3. Netlify te dara una URL gratis.
4. Cuando edites `index.html`, vuelve a arrastrar la carpeta para actualizar.

Alternativas gratis:

- GitHub Pages: mejor si quieres versionar cambios.
- Cloudflare Pages: buena opcion si luego compras dominio.
- WordPress.com: util si quieres blog, pero menos flexible para este HTML.

## Pendiente antes de publicar

- Agregar imagenes reales o permitidas de productos.
- Confirmar que todos los links Amazon usan tu tracking ID correcto.
- Cambiar la URL de Linktree para que apunte a esta pagina cuando este publicada.
- Agregar el nuevo enlace en Instagram y Pinterest.

## GitHub privado

Este folder ya esta inicializado como repositorio Git local. Para subirlo privado:

1. Crear un repo privado en GitHub llamado `eclatskinatelier-site`.
2. Agregar el remote:
   `git remote add origin https://github.com/TonyJoe29/eclatskinatelier-site.git`
3. Subir:
   `git branch -M main`
   `git push -u origin main`

Si Codex queda autorizado con acceso a ese repo, puedo seguir editando y versionando desde aqui.
