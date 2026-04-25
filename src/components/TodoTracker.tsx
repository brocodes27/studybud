import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Target, ListTodo, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Todo {
    id: string;
    text: string;
    completed: boolean;
    category: 'urgent' | 'regular' | 'backlog';
    createdAt: number; // timestamp ms
}

export function TodoTracker() {
    const { user } = useAuth() as any;
    const [todos, setTodos] = useState<Todo[]>(() => {
        const saved = localStorage.getItem('studybud_todos');
        return saved ? JSON.parse(saved) : [];
    });
    const [inputValue, setInputValue] = useState('');
    const [category, setCategory] = useState<Todo['category']>('regular');
    const [syncing, setSyncing] = useState(false);

    // Load from Supabase on mount / user change
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('user_todos')
                .select('id, text, completed, category, created_at')
                .eq('user_id', user.id)
                .order('sort_order', { ascending: true });
            if (cancelled) return;
            if (!error && data) {
                const loaded: Todo[] = data.map((row: any) => ({
                    id: row.id,
                    text: row.text,
                    completed: row.completed,
                    category: row.category,
                    createdAt: new Date(row.created_at).getTime(),
                }));
                setTodos(loaded);
                localStorage.setItem('studybud_todos', JSON.stringify(loaded));
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    // Optimistic localStorage mirror
    useEffect(() => {
        localStorage.setItem('studybud_todos', JSON.stringify(todos));
    }, [todos]);

    const syncTodo = useCallback(async (id: string, payload: any) => {
        if (!user?.id) return;
        await supabase.from('user_todos').update(payload).eq('id', id).eq('user_id', user.id);
    }, [user?.id]);

    const addTodo = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;
        const tempId = crypto.randomUUID();
        const newTodo: Todo = {
            id: tempId,
            text: inputValue.trim(),
            completed: false,
            category,
            createdAt: Date.now(),
        };
        setTodos(prev => [newTodo, ...prev]);
        setInputValue('');
        if (user?.id) {
            setSyncing(true);
            const { data, error } = await supabase.from('user_todos').insert({
                user_id: user.id,
                text: newTodo.text,
                completed: newTodo.completed,
                category: newTodo.category,
                sort_order: 0,
            }).select('id').single();
            if (!error && data) {
                setTodos(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t));
            }
            setSyncing(false);
        }
    };

    const toggleTodo = async (id: string) => {
        const nextCompleted = !todos.find(t => t.id === id)?.completed;
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: nextCompleted } : t));
        await syncTodo(id, { completed: nextCompleted });
    };

    const deleteTodo = async (id: string) => {
        setTodos(prev => prev.filter(t => t.id !== id));
        if (user?.id) {
            await supabase.from('user_todos').delete().eq('id', id).eq('user_id', user.id);
        }
    };

    const categories = [
        { id: 'urgent' as const, label: 'Urgent', activeColor: 'bg-red-500/10 border-red-500/30 text-red-500', dotColor: 'bg-red-400' },
        { id: 'regular' as const, label: 'Regular', activeColor: 'bg-[#00D1FF]/10 border-[#00D1FF]/30 text-[#00D1FF]', dotColor: 'bg-[#00D1FF]' },
        { id: 'backlog' as const, label: 'Backlog', activeColor: 'bg-[#64748B]/10 border-[#64748B]/30 text-[#64748B]', dotColor: 'bg-[#64748B]' },
    ];

    const getCategoryBadge = (cat: Todo['category']) => {
        const map = { urgent: 'bg-red-50 text-red-500 border border-red-100', regular: 'bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/20', backlog: 'bg-[#F8FAFF] text-[#64748B] border border-[#0A192F]/10' };
        return map[cat];
    };

    const pending = todos.filter(t => !t.completed).length;
    const done = todos.filter(t => t.completed).length;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[16px] flex items-center justify-center">
                    <ListTodo className="w-6 h-6 text-[#00D1FF]" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Study Tasks</h2>
                    <p className="text-xs font-medium text-[#64748B]">{pending} pending · {done} completed</p>
                </div>
            </div>

            {/* Add Task Form */}
            <form onSubmit={addTodo} className="neo-card space-y-4">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Add a new task..."
                        className="flex-1 px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#0A192F] font-medium placeholder-[#64748B]/40 focus:outline-none focus:border-[#00D1FF]/40 bg-white"
                    />
                    <button
                        type="submit"
                        className="neo-button px-5 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>

                <div className="flex gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border-2 font-bold text-xs transition-all ${category === cat.id ? cat.activeColor : 'bg-[#F8FAFF] border-[#0A192F]/10 text-[#64748B] hover:border-[#0A192F]/20'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${cat.dotColor}`} />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </form>

            {/* Todo List */}
            <div className="space-y-3">
                {todos.length === 0 ? (
                    <div className="text-center py-14 neo-card">
                        <Target className="w-12 h-12 text-[#0A192F]/10 mx-auto mb-4" />
                        <p className="font-bold text-[#64748B]">No tasks yet</p>
                        <p className="text-sm text-[#64748B]/60 mt-1">Add your first study task above</p>
                    </div>
                ) : (
                    todos
                        .sort((a, b) => {
                            if (a.completed !== b.completed) return a.completed ? 1 : -1;
                            return b.createdAt - a.createdAt;
                        })
                        .map((todo) => (
                            <div
                                key={todo.id}
                                className={`group flex items-center gap-4 p-4 rounded-[16px] border-2 transition-all ${todo.completed ? 'bg-[#F8FAFF] border-[#0A192F]/5 opacity-60' : 'bg-white border-[#0A192F]/8 hover:border-[#00D1FF]/20 hover:-translate-y-0.5 shadow-sm'}`}
                            >
                                <button
                                    onClick={() => toggleTodo(todo.id)}
                                    className="shrink-0 transition-colors"
                                >
                                    {todo.completed
                                        ? <CheckCircle2 className="w-5 h-5 text-[#34D399]" />
                                        : <Circle className="w-5 h-5 text-[#0A192F]/20 hover:text-[#00D1FF]" />
                                    }
                                </button>

                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold transition-all ${todo.completed ? 'line-through text-[#64748B]' : 'text-[#0A192F]'}`}>
                                        {todo.text}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryBadge(todo.category)}`}>
                                            {todo.category}
                                        </span>
                                        <span className="text-[10px] text-[#64748B]/60">
                                            {new Date(todo.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => deleteTodo(todo.id)}
                                    className="shrink-0 p-2 rounded-[8px] text-[#64748B] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
}
