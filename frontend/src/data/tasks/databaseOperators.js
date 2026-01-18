/**
 * Database Operators - Operadores para transferencias entre bases de datos
 * Airflow 2.4.0 - Incluye GCP, Azure, Oracle, PostgreSQL
 * Categoría: Databases
 */
export const databaseOperators = [
  {
    id: "postgres_operator",
    label: "PostgreSQL",
    type: "PostgresOperator",
    icon: "storage",
    category: "database",
    description: "Ejecuta comandos SQL en PostgreSQL",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "PostgreSQL",
        description: "ID único de la tarea (task_id)"
      },
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Comando SQL o nombre de archivo SQL"
      },
      postgres_conn_id: {
        type: "string",
        required: true,
        default: "postgres_default",
        description: "ID de conexión PostgreSQL"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros para la consulta SQL (dict)"
      },
      autocommit: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar en modo autocommit"
      },
      database: {
        type: "string",
        required: false,
        default: "",
        description: "Nombre de la base de datos (opcional)"
      }
    }
  },
  {
    id: "sql_execute",
    label: "SQL Execute",
    type: "SQLExecuteQueryOperator",
    icon: "database",
    category: "database",
    description: "Ejecuta una consulta SQL genérica (compatible con múltiples DBs)",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "SQL Execute",
        description: "ID único de la tarea (task_id)"
      },
      sql: {
        type: "string",
        required: true,
        default: "SELECT 1",
        description: "Consulta SQL a ejecutar"
      },
      conn_id: {
        type: "string",
        required: true,
        default: "postgres_default",
        description: "ID de la conexión de base de datos"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros para la consulta SQL"
      },
      autocommit: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar en modo autocommit"
      }
    }
  },
  {
    id: "oracle_operator",
    label: "Oracle",
    type: "OracleOperator",
    icon: "storage",
    category: "database",
    description: "Ejecuta comandos SQL en Oracle Database",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "Oracle",
        description: "ID único de la tarea (task_id)"
      },
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Comando SQL a ejecutar"
      },
      oracle_conn_id: {
        type: "string",
        required: true,
        default: "oracle_default",
        description: "ID de conexión Oracle"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros para la consulta SQL"
      },
      autocommit: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar en modo autocommit"
      }
    }
  },
  {
    id: "mssql_operator",
    label: "MSSQL / Azure SQL",
    type: "MsSqlOperator",
    icon: "storage",
    category: "database",
    description: "Ejecuta comandos SQL en Microsoft SQL Server o Azure SQL",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "MSSQL / Azure SQL",
        description: "ID único de la tarea (task_id)"
      },
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Comando SQL a ejecutar"
      },
      mssql_conn_id: {
        type: "string",
        required: true,
        default: "mssql_default",
        description: "ID de conexión MSSQL/Azure SQL"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros para la consulta SQL"
      },
      autocommit: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar en modo autocommit"
      }
    }
  },
  {
    id: "mysql_operator",
    label: "MySQL",
    type: "MySqlOperator",
    icon: "storage",
    category: "database",
    description: "Ejecuta comandos SQL en MySQL",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "MySQL",
        description: "ID único de la tarea (task_id)"
      },
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Comando SQL a ejecutar"
      },
      mysql_conn_id: {
        type: "string",
        required: true,
        default: "mysql_default",
        description: "ID de conexión MySQL"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros para la consulta SQL"
      },
      autocommit: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar en modo autocommit"
      }
    }
  }
];
