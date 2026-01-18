export const defaultDAG = [
    {
        id: "dag_definition",
        label: "DAG Definition",
        type: "DAG",
        icon: "account_tree",
        category: "common",
        description: "Define un DAG de Airflow con sus argumentos (schedule, tags, email, etc.). Todas las tareas irán dentro de este DAG.",
        parameters: {
            dag_id: {
                type: "string",
                required: true,
                default: "my_dag",
                description: "ID único del DAG (obligatorio)"
            },
            description: {
                type: "string",
                required: false,
                default: "",
                description: "Descripción del DAG"
            },
            schedule_interval: {
                type: "string",
                required: false,
                default: "@daily",
                description: "Intervalo de ejecución (ej: '@daily', '@hourly', '0 0 * * *', None)"
            },
            tags: {
                type: "array",
                required: false,
                default: [],
                description: "Tags para categorizar el DAG (ej: ['production', 'data-pipeline'])"
            },
            default_args: {
                type: "object",
                required: false,
                default: {
                    owner: "airflow",
                    email: "",
                    retries: 1,
                    retry_delay: "timedelta(minutes=5)"
                },
                description: "Argumentos por defecto para todas las tareas del DAG"
            },
            catchup: {
                type: "boolean",
                required: false,
                default: false,
                description: "Ejecutar ejecuciones pasadas automáticamente (catchup)"
            },
            max_active_runs: {
                type: "integer",
                required: false,
                default: 1,
                description: "Número máximo de ejecuciones activas simultáneas"
            },
            concurrency: {
                type: "integer",
                required: false,
                default: 16,
                description: "Número máximo de tareas que pueden ejecutarse simultáneamente"
            }
        }
    }
]
