const baseTopbarGroups = [
  {
    id: "file",
    label: "Archivo",
    icon: "description",
    functions: [
      {
        id: "new",
        label: "Nuevo DAG",
        icon: "add",
        action: "newDag",
        shortcut: "Ctrl+N"
      },
      {
        id: "open",
        label: "Abrir",
        icon: "folder_open",
        action: "openDag",
        shortcut: "Ctrl+O"
      },
      {
        id: "save",
        label: "Guardar",
        icon: "save",
        action: "saveDag",
        shortcut: "Ctrl+S"
      },
      {
        id: "templates",
        label: "Plantillas",
        icon: "dashboard_customize",
        action: "openTemplates",
        shortcut: ""
      }
    ]
  },
  {
    id: "export",
    label: "Exportar",
    icon: "file_download",
    functions: [
      {
        id: "exportPython",
        label: "Exportar Python",
        icon: "code",
        action: "exportDag",
        shortcut: "Ctrl+E"
      },
      {
        id: "exportJSON",
        label: "Exportar JSON",
        icon: "data_object",
        action: "exportJson",
        shortcut: "Ctrl+J"
      }
    ]
  },
  {
    id: "tools",
    label: "Herramientas",
    icon: "build",
    functions: [
      {
        id: "validate",
        label: "Validar DAG",
        icon: "check_circle",
        action: "validateDag",
        shortcut: "Ctrl+V"
      },
      {
        id: "format",
        label: "Formatear",
        icon: "format_list_bulleted",
        action: "formatDag",
        shortcut: "Ctrl+F"
      },
      {
        id: "optimize",
        label: "Optimizar",
        icon: "tune",
        action: "optimizeDag",
        shortcut: "Ctrl+T"
      }
    ]
  },
  {
    id: "settings",
    label: "Configuración",
    icon: "settings",
    functions: [
      {
        id: "settings",
        label: "Configuración",
        icon: "settings",
        action: "openSettings",
        shortcut: "Ctrl+,"
      },
      {
        id: "preferences",
        label: "Preferencias",
        icon: "tune",
        action: "openPreferences",
        shortcut: ""
      },
      {
        id: "about",
        label: "Acerca de",
        icon: "info",
        action: "showAbout",
        shortcut: ""
      }
    ]
  }
];

const adminTopbarGroup = {
  id: "admin",
  label: "Admin",
  icon: "admin_panel_settings",
  functions: [
    {
      id: "manageTasks",
      label: "Administrar Tasks",
      icon: "widgets",
      action: "openTaskAdmin",
      shortcut: ""
    },
    {
      id: "manageTemplates",
      label: "Administrar Plantillas",
      icon: "dashboard_customize",
      action: "openTemplateAdmin",
      shortcut: ""
    },
    {
      id: "manageCategories",
      label: "Organizar Categorías",
      icon: "category",
      action: "openCategoryAdmin",
      shortcut: ""
    }
  ]
};

export const getTopbarGroups = ({ isAdmin = false } = {}) => {
  if (!isAdmin) return baseTopbarGroups;
  return [...baseTopbarGroups, adminTopbarGroup];
};

export const topbarGroups = baseTopbarGroups;

// Mantener compatibilidad hacia atrás
export const topbarFunctions = topbarGroups.flatMap(group => group.functions);
