export const topbarGroups = [
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
        id: "saveAs",
        label: "Guardar Como...",
        icon: "save_as",
        action: "saveAsDag",
        shortcut: "Ctrl+Shift+S"
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
      },
      {
        id: "exportYAML",
        label: "Exportar YAML",
        icon: "article",
        action: "exportYaml",
        shortcut: "Ctrl+Y"
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

// Mantener compatibilidad hacia atrás
export const topbarFunctions = topbarGroups.flatMap(group => group.functions);
