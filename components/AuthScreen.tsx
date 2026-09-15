import React, { useState } from 'react';
import { User } from '../types';
import { APP_NAME } from '../constants';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // SIMULATED AUTHENTICATION
    // In a real production app, you would replace this with:
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    setTimeout(() => {
      const emailLower = email.toLowerCase();
      const isPaldamo = emailLower.includes('paldamo');

      // Mock successful login
      const mockUser: User = {
        id: email.split('@')[0], // Use email prefix as ID for this demo
        email: email,
        name: email.split('@')[0],
        plan: 'free',
        sessionsUsed: 0, // Initialize usage tracking
        // Grant 1000 credits if user is paldamo
        customSessionLimit: isPaldamo ? 1000 : undefined 
      };
      
      onLogin(mockUser);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-trackit-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-trackit-panel border border-slate-700 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-trackit-accent to-purple-500 mb-2">
            {APP_NAME}
          </h1>
          <p className="text-slate-400">
            {isLogin ? 'Welcome back, Executor.' : 'Join the elite.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-trackit-accent focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-trackit-accent focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-trackit-accent hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/25 transition-all flex justify-center items-center mt-6"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-500 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <p className="text-[10px] text-slate-600">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;