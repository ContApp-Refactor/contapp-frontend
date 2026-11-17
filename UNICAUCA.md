# Quitar / restaurar la Universidad del Cauca del front

> **Contexto:** el producto no puede usar identidad, logotipos ni información
> de la Universidad del Cauca (dominio y marca propios). Este documento deja
> listo el mecanismo para **quitarlo y devolverlo con un comando**, sin perder
> trabajo de UI/UX hecho en `contapp-frontend`.
>
> Estado actual de `modulo-pp7-comercial`: **la U está QUITADA** (`f5294717`).

---

## Comandos (correr en `bootstrap/contapp-frontend`)

Ambos comandos fueron **probados hoy en ambos sentidos y no generan conflictos**.

| Acción | Comando |
|---|---|
| **Devolver la universidad** | `git revert -n f5294717 93dcfdf2 && git revert --continue` |
| **Quitar la universidad** (después de devolverla) | `git revert --no-edit $(git rev-parse HEAD)` |

- **Devolver** revierte en orden el cambio de placeholder (`f5294717`) y la
  re-aplicación de la quita (`93dcfdf2`); revierte el par completo hace que
  los placeholders vuelvan a `usuario@unicauca.edu.co` sin conflicto.
- **Quitar** funciona mientras el commit de arriba sea el HEAD (es el último
  commit tras restaurar). Para confirmarlo: `git log --oneline -1`.
- El arreglo del **header del login** (`e767f7a7`) **no se revierte** en
  ninguno de los dos sentidos: es un fix real y aplica con o sin la U.

---

## Por qué NO sirve `git merge` para conmutar

Una vez que se hace `git revert` de los commits de la quita, **git ya los
considera parte de la historia**: `git merge ui/quitar-unicauca` no reaplica
nada (lo ve como "ya mergeado").

- **Conmutar** → siempre con `git revert` (funciona en los dos sentidos).
- **`git merge ui/quitar-unicauca`** → solo sirve cuando la rama está
  **adelante** de la actual (estado inicial, fast-forward).
- **`cherry-pick`** → para llevar la quita a una rama que no la tiene.

---

## Restaurar SOLO lo de la U sin perder merges de otras ramas

Este es el caso: `develop` ya tiene merges de otras ramas y sólo se quieren
devolver los logos/textos de la U.

```bash
git revert -n f5294717 93dcfdf2 && git revert --continue
```

`git revert` **no reescribe la historia**: agrega un commit encima, así que
todo lo que otras ramas hayan aportado en **otros archivos** queda intacto.
Los commits que tocan los **mismos archivos** (footers, recibos) pueden
generar conflicto → resolverlo conservando el contenido nuevo **y** restaurando
el bloque `[UNICAUCA]`.

---

## La rama `ui/quitar-unicauca`

Apunta al mismo HEAD que `modulo-pp7-comercial`: el estado con la U quitada,
el login arreglado, los placeholders neutros y este documento. No lleva
trabajo propio.

```bash
git branch -f ui/quitar-unicauca HEAD   # sincroniza si HEAD avanzó
git log --oneline ui/quitar-unicauca -1
```

---

## Qué cambia la quita (21 archivos)

| Grupo | Detalle |
|---|---|
| **Assets** | Se eliminan de `public/`: `logo_unicauca.png`, `_completo`, `_horizontal`, `_sm` y `unicauca-economia.jpg`. Siguen en el historial de git → se recuperan con `git checkout <commit>~1 -- public/`. |
| **Logos en HTML** |13 `<img>` reemplazados por `public/logo-default.svg` (isotipo azul64×64, **sin texto** porque el HTML ya renderiza `<span class="app-title">ContApp</span>`). |
| **Footers** | Universidad del Cauca, NIT891500319, Facultad de Ciencias Contables, División de TIC y acreditación **MEN6218 / Vigilada MinEducación** → quedan **comentados** con marcas `[UNICAUCA]` … `[/UNICAUCA]`, y se pone una versión `[CONTAPP]` al lado. |
| **Recibos / detalle de factura** | `EMPRESA UNIVERSIDAD DEL CAUCA S.A.S`, su NIT y dirección → comentados con valores `—` por completar. |
| **Validación de correo** | La que solo aceptaba `@unicauca.edu.co` al compartir una empresa → **comentada** (ya aplica cualquier dominio). |
| **Placeholders** | `usuario@unicauca.edu.co` → `usuario@contapp.app` (login, registro, olvide clave, compartir empresa). |
| **Environments** | `dev`/`test`/base: URLs y usuario de la U comentados. **`environment.docker.ts` (el que se compila) nunca tuvo nada de la U.** |

> Los bloques marcados **no se borran del código**: quedan comentados con
> `[UNICAUCA]` … `[/UNICAUCA]`. Son la fuente para restaurar a mano cualquier
> pieza puntual.

### Marcado para restaurar

Todo lo retirado queda en el mismo archivo, listo para descomentar:

```html
<!-- ===== [UNICAUCA] BLOQUE ORIGINAL — referencias a la Universidad del Cauca. ===== -->
<!--   ...contenido original... -->
<!-- ===== [/UNICAUCA] ===== -->
<!-- ===== [CONTAPP] versión sin referencias a la universidad ===== -->
...versión nueva...
<!-- ===== [/CONTAPP] ===== -->
```

---

## Arreglo de login (sobrevive a cualquier quita/devolución)

Dos problemas distintos, ambos **fuera** de los commits de la quita:

1. **Logo ancho** (`4791a2b3`): `logo-default.svg` medía `240×64` y traía el
   texto "ContApp" dentro; a `.logo { height:60px }` resultaba **225px de
   ancho** y montaba "ContApp" sobre "Inicio de sesión".
   - `public/logo-default.svg` → `64×64`, solo isotipo.
   - `login.component.css` → `.logo` añade `max-width:180px; object-fit:contain`.

2. **Header flotante** (`e767f7a7`): `.login-header` era `position:absolute`
   a `top:30px` y ocupaba `y=30..90`, mientras el título "Inicio de sesión"
   arrancaba en `y≈32` → **se solapaban en TODO ancho ≥768px** (la media query
   `max-width:767px` sólo lo ocultaba por debajo de ese ancho).
   - `.login-header` → en **flujo normal** (`padding:24px 30px 0`); el `body`
     ya es `flex-column`, así que queda arriba y **no puede pisar a nada en
     ningún tamaño de pantalla**. Se eliminó la media query.

---

## Cómo verificar que quedó limpio

```bash
# ocurrencias de "unicauca" en el bundle servido → debe dar0
B=$(curl -s http://localhost/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "http://localhost/$B" | grep -oi unicauca | wc -l

# assets de la U → debe dar404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/logo_unicauca.png

# fuente → no debe quedar "unicaucacontapp" ni placeholders activos de la U
grep -rniI 'unicaucacontapp' src public environments | grep -v node_modules
# da4 y TODOS comentados (nota [UNICAUCA] placeholder original); si alguno
# aparece sin <!-- al frente, está activo y hay que sacarlo
grep -rn 'usuario@unicauca.edu.co' src --include='*.html'
```

También en el navegador: `/login`, el menú lateral y cualquier footer.
Los mailto `@unicauca.edu.co` que quedan en el código están **dentro** de los
bloques `<!-- [UNICAUCA] … -->` y por eso no llegan al bundle.
