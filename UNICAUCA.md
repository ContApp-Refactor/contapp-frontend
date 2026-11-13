# Quitar / restaurar la Universidad del Cauca del front

> **Contexto:** se contrató el dominio **`unicaucacontapp.app`**, por lo que el
> producto no puede usar identidad, logotipos ni información de la
> Universidad del Cauca. Este documento deja listo el mecanismo para
> **quitarlo y devolverlo con un comando**, sin perder trabajo de UI/UX
> hecho en `contapp-frontend`.

---

## Comandos (correr en `bootstrap/contapp-frontend`)

| Acción | Comando |
|---|---|
| **Quitar la universidad** | `git revert --no-edit $(git log --format=%H --grep='Revert "feat(ui): retira' -1)` |
| **Devolver la universidad** | `git revert --no-edit3a621d93 dce752a9` |
| **Aplicar la quita en otra rama** | `git cherry-pick dce752a93a621d93` |

- Si **nunca se revirtió**, la quita ya está aplicada (estado por defecto).
- Tras **devolver** la universidad, el segundo comando es el que se usa
  para quitarla otra vez: busca solo el hash del revert, así no hace falta
  recordarlo.
- El hash de los commits puede cambiar si se rehacen; localizarlos con
  `git log --oneline --grep='retira toda referencia' --grep='Revert "feat(ui): retira'`.

### ⚠️ Conflicto conocido y resolución

`public/logo-default.svg` fue **creado** por la quita y **modificado después**
(por el arreglo de login). Al devolver la universidad, git reporta:

```
CONFLICT (modify/delete): public/logo-default.svg deleted in parent of dce752a9
```

**Resolución:** conservar el archivo (no borrarlo) —

```bash
git revert --no-edit3a621d93 dce752a9 || {
  git add public/logo-default.svg
  GIT_EDITOR=true git revert --continue
}
```

Así quedan **ambos**: el logo de la universidad (el que usa el HTML) y el
logo por defecto (disponible por si se vuelve a quitar la U).

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

## La rama `ui/quitar-unicauca`

Snapshot de la quita (`3a621d93`). Sirve como **referencia estable**:

```bash
git diff ui/quitar-unicauca~2..ui/quitar-unicauca   # exactamente el cambio de la quita
```

---

## Qué cambia la quita (22 archivos)

| Grupo | Detalle |
|---|---|
| **Assets** | Se eliminan de `public/`: `logo_unicauca.png`, `_completo`, `_horizontal`, `_sm` y `unicauca-economia.jpg`. Siguen en el historial de git → se recuperan con `git checkout <commit>~1 -- public/`. |
| **Logos en HTML** |13 `<img>` reemplazados por `public/logo-default.svg` (isotipo azul64×64, **sin texto** porque el HTML ya renderiza `<span class="app-title">ContApp</span>`). |
| **Footers** | Universidad del Cauca, NIT891500319, Facultad de Ciencias Contables, División de TIC y acreditación **MEN6218 / Vigilada MinEducación** → quedan **comentados** con marcas `[UNICAUCA]` … `[/UNICAUCA]`, y se pone una versión `[CONTAPP]` al lado. |
| **Recibos / detalle de factura** | `EMPRESA UNIVERSIDAD DEL CAUCA S.A.S`, su NIT y dirección → comentados con valores `—` por completar. |
| **Validación de correo** | La que solo aceptaba `@unicauca.edu.co` al compartir una empresa → **comentada** (ya aplica cualquier dominio). |
| **Placeholders** | `usuario@unicauca.edu.co` → `usuario@unicaucacontapp.app` (login, registro, olvide clave, compartir empresa). |
| **Environments** | `dev`/`test`/base: URLs y usuario de la U comentados. **`environment.docker.ts` (el que se compila) nunca tuvo nada de la U.** |

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

El logo por defecto medía `240×64` y traía el texto "ContApp" dentro; a
`.logo { height:60px }` resultaba **225px de ancho**, desplazaba el header y
montaba "ContApp" sobre "Inicio de sesión".

- **`public/logo-default.svg`** → ahora `64×64`, solo isotipo (como el logo
  original de la U, que tampoco traía texto).
- **`src/app/Core/auth/login/login.component.css`** → `.logo` añade
  `max-width:180px; object-fit:contain`.

⚠️ **El CSS está en un commit aparte (`4791a2b3`), fuera de los commits de
la quita**, así que el guard se conserva tanto quitando como devolviendo la U.

---

## Cómo verificar que quedó limpio

```bash
# en el bundle servido (debe dar0 todas)
docker exec contapp-frontend sh -c \
  "grep -ro 'Universidad del Cauca\|unicauca.edu.co\|891500319\|MinEducación' /usr/local/apache2/htdocs/ | wc -l"

curl -s -o /dev/null -w '%{http_code}\n' http://localhost/logo_unicauca.png   #404 quitado /200 devuelto
```

También en el navegador: `/login`, el menú lateral y cualquier footer.
