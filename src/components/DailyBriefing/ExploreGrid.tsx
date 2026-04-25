import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, FlaskConical, Trophy, Users } from 'lucide-react';

export function ExploreGrid() {
  const navigate = useNavigate();

  const workspaces = [
    {
      label: 'Knowledge Atlas',
      icon: Brain,
      route: '/atlas',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      iconColor: 'text-indigo-500',
    },
    {
      label: 'Mastery Tree',
      icon: Trophy,
      route: '/mastery-tree',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      iconColor: 'text-rose-500',
    },
    {
      label: 'JEE Practice',
      icon: FlaskConical,
      route: '/prove-it?subject=JEE%20Physics&topic=Rotational%20Dynamics',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      iconColor: 'text-emerald-500',
    },
    {
      label: 'Squad',
      icon: Users,
      route: '/squad-prove-it',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      iconColor: 'text-amber-500',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-2xl mx-auto pb-10 text-center"
    >
      <h2 className="text-xl md:text-2xl font-extrabold text-[#0A192F] mb-3">
        Ready for more?
      </h2>
      <p className="text-sm text-[#64748B] mb-8">
        Your daily tasks are complete. Dive deeper into the platform or review your progress.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {workspaces.map((ws) => (
          <button 
            key={ws.label} 
            onClick={() => navigate(ws.route)} 
            className={`flex flex-col items-center justify-center p-6 rounded-2xl border ${ws.border} ${ws.bg} hover:shadow-sm transition-all group`}
          >
            <ws.icon className={`w-8 h-8 ${ws.iconColor} mb-3 group-hover:scale-110 transition-transform`} />
            <span className="text-xs font-bold text-[#0A192F]">{ws.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
