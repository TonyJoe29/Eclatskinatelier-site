# Telegram offers bot MVP

Bot privado para revisar ofertas de Amazon antes de publicarlas en un grupo de Telegram.

El flujo del MVP es:

1. Tu mandas una oferta candidata al bot por privado.
2. El bot valida reglas minimas: descuento, reviews, rating y categoria.
3. El bot te muestra una vista previa con imagen, datos y botones.
4. Si apruebas, el bot publica en el grupo.
5. Si rechazas, la oferta queda guardada como rechazada.

## Grupo vs canal

Grupo:
- Mejor para comunidad, comentarios y conversacion.
- El bot publica como bot dentro del grupo.
- Necesita moderacion si el grupo crece.

Canal:
- Mejor para ofertas limpias tipo broadcast.
- Los suscriptores reciben solo publicaciones.
- El bot tambien puede publicar si es administrador del canal.

Este MVP funciona con grupo. Luego se puede usar el mismo bot con canal cambiando `TELEGRAM_GROUP_CHAT_ID`.

## Configuracion

1. Crea el bot con `@BotFather` en Telegram y guarda el token.
2. Copia `.env.example` a `.env` dentro de esta carpeta.
3. Pega el token en `TELEGRAM_BOT_TOKEN`.
4. Arranca el bot:

```bash
npm start
```

5. Abre el chat privado con tu bot y manda `/start`.
6. Copia `Your user ID` en `TELEGRAM_ADMIN_CHAT_ID`.
7. Crea tu grupo, agrega el bot al grupo y dale permiso para publicar.
   Si quieres que el bot actualice la descripcion del grupo, dale tambien permiso para cambiar informacion del grupo.
8. En el grupo manda `/chatid`.
9. Copia el `Chat ID` del grupo en `TELEGRAM_GROUP_CHAT_ID`.
10. Reinicia el bot.

## Variables

```bash
TELEGRAM_BOT_TOKEN=token_del_bot
TELEGRAM_ADMIN_CHAT_ID=tu_user_id
TELEGRAM_GROUP_CHAT_ID=id_del_grupo

AMAZON_ASSOCIATE_TAG=luxeskinateli-20
POST_LANGUAGE=en

MIN_DISCOUNT_PERCENT=5
MIN_REVIEW_COUNT=1000
MIN_RATING=4
```

`POST_LANGUAGE` acepta `en` o `es`. El MVP publica en ingles por defecto.

## Crear una oferta pendiente

Manda esto por privado al bot:

```text
/offer
title=Maybelline Lash Sensational Sky High Mascara
url=https://www.amazon.com/dp/B08H4FSGDW
image=https://m.media-amazon.com/images/I/example.jpg
before=14.99
after=10.99
rating=4.5
reviews=85000
category=makeup
```

Categorias aceptadas:

- `makeup`
- `skincare`
- `perfume`
- `perfumes de mujer`
- `bodycare`

Tambien acepta algunos equivalentes en espanol como `maquillaje`, `cuidado de piel` y `cuidado corporal`.

La imagen es obligatoria. Debe ser una URL publica que Telegram pueda descargar.

## Descripcion del grupo

El disclosure de afiliado vive en la descripcion del grupo para mantener cada oferta mas limpia:

```text
Curated beauty deals for makeup, skincare, body care, and women's fragrance. We share approved finds only. As an Amazon Associate, I earn from qualifying purchases. Prices and availability may change.
```

## Notas de Amazon

- Usa enlaces de producto de `amazon.com`, idealmente formato `/dp/ASIN`.
- El bot convierte el enlace a `https://www.amazon.com/dp/ASIN?tag=luxeskinateli-20`.
- No uses links cortos `amzn.to` en este MVP.
- Precios, disponibilidad, ratings e imagenes deben venir de una fuente autorizada por Amazon si se automatizan.
- Para automatizar busqueda de ofertas, el siguiente paso correcto es conectar Amazon Creators API con tus credenciales.

## Despliegue MVP

En Render, crea un `Background Worker` o servicio equivalente:

- Root directory: `telegram-bot`
- Build command: `npm install`
- Start command: `npm start`
- Node version: 20 o superior

Agrega las mismas variables de `.env` en el panel de Render.

Este repo tambien incluye un `render.yaml` para crear el worker como Blueprint. Los secretos usan `sync: false`, asi que Render te pedira pegarlos en el dashboard y no se suben al repo.
