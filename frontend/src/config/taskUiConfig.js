export const FRAMEWORK_UI = {
  airflow: { label: "Airflow", icon: "account_tree" },
  argo: { label: "Argo", icon: "hub" },
};

export const FRAMEWORK_OPTIONS = Object.entries(FRAMEWORK_UI).map(
  ([value, meta]) => ({
    value,
    label: meta.label,
    icon: meta.icon,
  }),
);

export const CATEGORY_ORDER_BY_FRAMEWORK = {
  airflow: ["common", "airflow", "util", "google_cloud", "database", "transfer", "python", "sql", "sensors", "others"],
  argo: ["common", "argo", "steps", "workflow", "others"],
};

export const CATEGORY_LABELS = {
  common: "Favoritos",
  airflow: "Airflow",
  argo: "Argo",
  util: "Utilidades",
  google_cloud: "Google Cloud",
  database: "Databases",
  transfer: "SFTP / Transfer",
  python: "Python",
  sql: "SQL",
  sensors: "Sensors",
  others: "Otros",
  steps: "Steps",
  workflow: "Workflow",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const CATEGORY_ICONS = {
  common: "star",
  airflow: "account_tree",
  argo: "hub",
  util: "extension",
  google_cloud: "cloud",
  database: "storage",
  transfer: "swap_horiz",
  python: "code",
  sql: "table_rows",
  sensors: "sensors",
  others: "more_horiz",
  steps: "play_arrow",
  workflow: "account_tree",
};

export const OPERATOR_PALETTE_STYLES = {
  DAG: { borderClass: "border-l-indigo-500", hoverClass: "hover:bg-indigo-50", iconClass: "text-indigo-500 group-hover:text-indigo-600" },
  ArgoWorkflow: { borderClass: "border-l-violet-500", hoverClass: "hover:bg-violet-50", iconClass: "text-violet-500 group-hover:text-violet-600" },
  BashOperator: { borderClass: "border-l-emerald-500", hoverClass: "hover:bg-emerald-50", iconClass: "text-emerald-500 group-hover:text-emerald-600" },
  PythonOperator: { borderClass: "border-l-blue-500", hoverClass: "hover:bg-blue-50", iconClass: "text-blue-500 group-hover:text-blue-600" },
  PythonVirtualenvOperator: { borderClass: "border-l-indigo-500", hoverClass: "hover:bg-indigo-50", iconClass: "text-indigo-500 group-hover:text-indigo-600" },
  PostgresOperator: { borderClass: "border-l-cyan-500", hoverClass: "hover:bg-cyan-50", iconClass: "text-cyan-500 group-hover:text-cyan-600" },
  BigQueryOperator: { borderClass: "border-l-purple-500", hoverClass: "hover:bg-purple-50", iconClass: "text-purple-500 group-hover:text-purple-600" },
  SQLExecuteQueryOperator: { borderClass: "border-l-teal-500", hoverClass: "hover:bg-teal-50", iconClass: "text-teal-500 group-hover:text-teal-600" },
  LocalFilesystemToS3Operator: { borderClass: "border-l-orange-500", hoverClass: "hover:bg-orange-50", iconClass: "text-orange-500 group-hover:text-orange-600" },
  S3ToS3Operator: { borderClass: "border-l-amber-500", hoverClass: "hover:bg-amber-50", iconClass: "text-amber-500 group-hover:text-amber-600" },
  SFTPOperator: { borderClass: "border-l-sky-500", hoverClass: "hover:bg-sky-50", iconClass: "text-sky-500 group-hover:text-sky-600" },
  GCSToBigQueryOperator: { borderClass: "border-l-violet-500", hoverClass: "hover:bg-violet-50", iconClass: "text-violet-500 group-hover:text-violet-600" },
  FileSensor: { borderClass: "border-l-pink-500", hoverClass: "hover:bg-pink-50", iconClass: "text-pink-500 group-hover:text-pink-600" },
  S3KeySensor: { borderClass: "border-l-rose-500", hoverClass: "hover:bg-rose-50", iconClass: "text-rose-500 group-hover:text-rose-600" },
  SqlSensor: { borderClass: "border-l-green-500", hoverClass: "hover:bg-green-50", iconClass: "text-green-500 group-hover:text-green-600" },
  HttpSensor: { borderClass: "border-l-red-500", hoverClass: "hover:bg-red-50", iconClass: "text-red-500 group-hover:text-red-600" },
  DummyOperator: { borderClass: "border-l-gray-500", hoverClass: "hover:bg-gray-50", iconClass: "text-gray-500 group-hover:text-gray-600" },
  BranchPythonOperator: { borderClass: "border-l-yellow-500", hoverClass: "hover:bg-yellow-50", iconClass: "text-yellow-500 group-hover:text-yellow-600" },
  ShortCircuitOperator: { borderClass: "border-l-amber-500", hoverClass: "hover:bg-amber-50", iconClass: "text-amber-500 group-hover:text-amber-600" },
};

export const CATEGORY_CARD_STYLES = {
  util: "border-l-emerald-500 bg-emerald-50/35",
  airflow: "border-l-blue-500 bg-blue-50/35",
  argo: "border-l-indigo-500 bg-indigo-50/35",
  python: "border-l-violet-500 bg-violet-50/35",
  sql: "border-l-cyan-500 bg-cyan-50/35",
  database: "border-l-teal-500 bg-teal-50/35",
  transfer: "border-l-orange-500 bg-orange-50/35",
  sensors: "border-l-pink-500 bg-pink-50/35",
  google_cloud: "border-l-sky-500 bg-sky-50/35",
  others: "border-l-slate-500 bg-slate-50/50",
};

export const ICON_OPTIONS = [
  "extension",
  "account_tree",
  "terminal",
  "code",
  "database",
  "storage",
  "cloud",
  "hub",
  "sensors",
  "schedule",
  "swap_horiz",
  "api",
  "build",
  "settings",
  "task",
  "description",
  "integration_instructions",
  "data_object",
  "tune",
  "route",
];

export const OPERATOR_NODE_STYLES = {
  DAG: { icon: "account_tree", color: "indigo" },
  ArgoWorkflow: { icon: "hub", color: "violet" },
  BashOperator: { icon: "terminal", color: "emerald" },
  PythonOperator: { icon: "code", color: "blue" },
  PythonVirtualenvOperator: { icon: "workspace", color: "indigo" },
  PostgresOperator: { icon: "storage", color: "cyan" },
  BigQueryOperator: { icon: "cloud", color: "purple" },
  SQLExecuteQueryOperator: { icon: "database", color: "teal" },
  LocalFilesystemToS3Operator: { icon: "upload_file", color: "orange" },
  S3ToS3Operator: { icon: "file_copy", color: "amber" },
  SFTPOperator: { icon: "cloud_sync", color: "sky" },
  GCSToBigQueryOperator: { icon: "cloud_upload", color: "violet" },
  FileSensor: { icon: "sensors", color: "pink" },
  S3KeySensor: { icon: "cloud_done", color: "rose" },
  SqlSensor: { icon: "data_check", color: "green" },
  HttpSensor: { icon: "http", color: "red" },
  DummyOperator: { icon: "radio_button_unchecked", color: "gray" },
  BranchPythonOperator: { icon: "call_split", color: "yellow" },
  ShortCircuitOperator: { icon: "electric_bolt", color: "amber" },
};

export const NODE_COLOR_CLASSES = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  purple: "bg-purple-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  green: "bg-green-500",
  red: "bg-red-500",
  gray: "bg-gray-500",
  yellow: "bg-yellow-500",
  slate: "bg-slate-500",
};

export const NODE_BORDER_COLOR_CLASSES = {
  emerald: "border-emerald-300",
  blue: "border-blue-300",
  indigo: "border-indigo-300",
  cyan: "border-cyan-300",
  purple: "border-purple-300",
  teal: "border-teal-300",
  orange: "border-orange-300",
  amber: "border-amber-300",
  sky: "border-sky-300",
  violet: "border-violet-300",
  pink: "border-pink-300",
  rose: "border-rose-300",
  green: "border-green-300",
  red: "border-red-300",
  gray: "border-gray-300",
  yellow: "border-yellow-300",
  slate: "border-slate-300",
};

export const getOperatorPaletteStyle = (type) =>
  OPERATOR_PALETTE_STYLES[type] || {
    borderClass: "border-l-slate-500",
    hoverClass: "hover:bg-slate-50",
    iconClass: "text-slate-500 group-hover:text-slate-600",
  };

export const getOperatorNodeStyle = (type) =>
  OPERATOR_NODE_STYLES[type] || { icon: "widgets", color: "slate" };
