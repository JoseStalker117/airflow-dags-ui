import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register, loginAnonymous } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/splash');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al iniciar sesión';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, password);
      navigate('/splash');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al crear la cuenta';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await loginAnonymous();
      navigate('/splash');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al acceder como invitado';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700"
      >
        {/* Logo */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
            Dagger
          </h1>
          <p className="text-gray-400 text-sm">Visual DAG Flow Builder</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-md transition-all font-medium ${
              isLogin 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-md transition-all font-medium ${
              !isLogin 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2 text-sm font-medium">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="tu@email.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2 text-sm font-medium">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
            />
            {!isLogin && (
              <p className="text-xs text-gray-400 mt-1">
                Mínimo 6 caracteres
              </p>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </span>
            ) : (
              isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'
            )}
          </button>
        </form>

        {/* Divisor */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-800 text-gray-400">o continúa con</span>
          </div>
        </div>

        {/* Acceso anónimo */}
        <button
          onClick={handleAnonymousLogin}
          disabled={loading}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          Acceso como Invitado
        </button>

        <p className="text-center text-gray-500 text-xs mt-6">
          Al continuar, aceptas nuestros términos de servicio y política de privacidad
        </p>
      </motion.div>
    </div>
  );
};

export default Login;