# Colección `task` en Firestore

Los bloques del palette (Airflow y Argo) **se leen desde esta colección**. Los cambios en cloud los reciben todos los usuarios.

## Esquema de un documento

| Campo             | Tipo     | Obligatorio | Descripción |
|-------------------|----------|-------------|-------------|
| `name`            | string   | Sí          | Nombre mostrado en el palette |
| `type`            | string   | Sí          | Tipo del operador (ej: `DAG`, `BashOperator`, `ArgoWorkflow`) |
| `icon`            | string   | No          | Material icon name (ej: `terminal`, `account_tree`) |
| `category`        | string   | Sí          | Subsección del framework (ej: `util`, `airflow`, `steps`, `argo`) |
| `description`     | string   | No          | Tooltip del bloque |
| `parameters`      | object   | No          | Definición de parámetros del nodo |
| `framework`       | string   | Sí          | `airflow` o `argo` (determina en qué sección del palette aparece) |
| `platform`        | string   | Sí          | Ej: `airflow`, `argo` |
| `template`        | string   | Sí          | Identificador de plantilla |
| `isDefaultFavorite` | boolean | No        | Si es true, aparece en "Favoritos" de ese framework |
| `isActive`        | boolean  | No          | Si es false, no se lista (soft delete). Default true. |

## Seed inicial

Para poblar la colección con bloques mínimos (Airflow + Argo):

```bash
cd backend
python -m scripts.seed_tasks
```

Luego puedes añadir más documentos desde la consola de Firestore o vía API (POST `/api/tasks` con usuario admin).

## Favoritos

Cada framework tiene su sección **Favoritos**. En ella se muestran los bloques con `isDefaultFavorite: true` de ese framework. No hace falta duplicar documentos: el mismo documento aparece en su categoría y en Favoritos si tiene la bandera.
