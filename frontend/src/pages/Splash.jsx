import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/home");
    }, 3400);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white overflow-hidden font-sans">

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="flex flex-col items-center max-w-[480px] w-full px-6"
      >

        {/* Logo */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.9 }}
          className="mb-10"
        >
          <div className="w-24 h-24 flex items-center justify-center rounded-3xl bg-slate-900 shadow-xl">
            <span className="material-symbols-outlined text-white text-5xl font-light">
              polymer
            </span>
          </div>
        </motion.div>

        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "0.3em" }}
          animate={{ opacity: 1, letterSpacing: "0.05em" }}
          transition={{ delay: 0.7, duration: 1 }}
          className="mb-12 text-5xl font-extrabold tracking-tight text-slate-900"
        >
          DAGGER
        </motion.h1>

        {/* Barra */}
        <div className="w-full max-w-[300px]">
          <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-slate-900 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3, ease: "easeInOut" }}
            />
          </div>
        </div>

      </motion.div>

      {/* Versión */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.4, y: 0 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 flex flex-col items-center gap-2"
      >
        <span className="text-xs font-medium tracking-[0.25em] uppercase text-slate-900">
          Version 1.0.0
        </span>
      </motion.div>

    </div>
  );
}
