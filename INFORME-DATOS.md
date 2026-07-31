# Informe de datos y decisiones — MAXIM QA/QC

Resumen de cómo quedó el Excel al normalizarlo y las dudas que necesito que revises.

## Qué se cargó
- **50 equipos/herramientas** (una por cada hoja del Excel).
- **306 consumibles** en total.
- **26 herramientas (HTA)** y **24 equipos de presión (PCE)** — se tomó de la columna CATEGORIA.
- **10 fabricantes**: Tools Universal (18), PSI (11), TIC (8), Baoji Jinhui (5),
  Yancheng City Lilin (3), Bowen, Baoji Safe, MF, CR, Elmar.
- **9 equipos ya referencian un PDF de ficha técnica** por su nombre (habrá que subir esos PDFs).

## Limpieza aplicada automáticamente
1. Se eliminaron las filas basura `Columna1 / Columna2 / Columna3`.
2. En las hojas donde CANTIDAD y REFERENCIA estaban invertidas (N-Testool y las 3 "ADVISORY"),
   se reordenó cada valor a su columna correcta leyendo el encabezado real de la hoja.
3. La hoja **BOP 3 1-2 CR** no tenía columnas de categoría y venía en dos bloques
   (**BRAZO DE BOP** y **ECUALIZADOR**): se conservaron como *grupos* dentro del mismo equipo.
4. Las medidas se estandarizaron (ej. `1,78"` y `3 1-2` → `1.78"` y `3 1/2"`).

## ⚠️ Dudas / posibles errores del Excel que debes confirmar
1. **La hoja "LUBRICADOR- PSI" tiene como título interno "STUFFING BOX- PSI".**
   Parece un error de copiado. Lo clasifiqué como LUBRICADOR por el nombre de la hoja,
   pero el nombre visible quedó "STUFFING BOX- PSI". ¿Cuál es el nombre correcto?
2. **"TOOL TRAP 3 1-2 ADVISORY" dice internamente "TOOP TRAP"** (falta la L). ¿Confirmas TOOL TRAP?
3. **Hay dos hojas "MARTILLO HIDRAULICO 1 7-8"** con contenido distinto (una con 2 consumibles,
   otra con 6). Las dejé como equipos separados. ¿Son realmente dos, o una es duplicado?
4. **Fabricantes que quedaron como sigla** ("MF", "TIC", "CR"): ¿quieres el nombre completo?
5. Algunos equipos "ADVISORY" traen la referencia en blanco (venían así en el Excel).

Estas dudas no bloquean nada: la app ya funciona. Solo corrígelas cuando puedas y me avisas
para actualizar los datos, o edítalas tú mismo desde la app una vez conectado Supabase.
