import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopbarGroups } from "../data/topbarFunctions";

export default function TopBar({ onAction, isAdmin = false }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const groupRefs = useRef({});
  const topbarGroups = getTopbarGroups({ isAdmin });

  const getMenuPosition = (groupId) => {
    const anchor = groupRefs.current[groupId];
    if (!anchor) return { top: 56, left: 8 };

    const rect = anchor.getBoundingClientRect();
    return {
      top: rect.bottom,
      left: Math.max(8, rect.left),
    };
  };

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeGroup && groupRefs.current[activeGroup]) {
        if (!groupRefs.current[activeGroup].contains(event.target)) {
          setActiveGroup(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeGroup]);

  const handleGroupClick = (groupId) => {
    setActiveGroup(activeGroup === groupId ? null : groupId);
  };

  const handleFunctionClick = (action) => {
    onAction(action);
    setActiveGroup(null);
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-[120] flex-shrink-0"
    >
      {/* Barra principal de grupos */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 overflow-x-auto whitespace-nowrap">
        {topbarGroups.map((group) => (
          <div key={group.id} ref={(el) => (groupRefs.current[group.id] = el)} className="relative">
            <button
              onClick={() => handleGroupClick(group.id)}
              className={`
                flex items-center gap-2 px-3 sm:px-4 py-2 rounded-t-md text-xs sm:text-sm font-medium
                transition-all duration-200 min-w-[88px] sm:min-w-[100px]
                ${activeGroup === group.id
                  ? "bg-blue-50 text-blue-700 border-t-2 border-x border-blue-300 border-b-2 border-b-transparent"
                  : "text-slate-700 hover:bg-gray-50 hover:text-slate-900"
                }
              `}
            >
              <span className="material-symbols-outlined text-base">
                {group.icon}
              </span>
              <span>{group.label}</span>
              <span className={`material-symbols-outlined text-xs transition-transform duration-200 ${
                activeGroup === group.id ? "rotate-180" : ""
              }`}>
                expand_more
              </span>
            </button>

            {/* Menú desplegable */}
            <AnimatePresence>
              {activeGroup === group.id && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="fixed mt-0 bg-white border border-blue-300 border-t-0 rounded-b-md shadow-lg min-w-[220px] max-w-[90vw] z-[220]"
                  style={getMenuPosition(group.id)}
                >
                  <div className="py-1">
                    {group.functions.map((fn) => (
                      <button
                        key={fn.id}
                        onClick={() => handleFunctionClick(fn.action)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg text-slate-500">
                          {fn.icon}
                        </span>
                        <div className="flex-1 flex items-center justify-between">
                          <span className="font-medium">{fn.label}</span>
                          {fn.shortcut && (
                            <span className="text-xs text-slate-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                              {fn.shortcut}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
