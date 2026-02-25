import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Target, ListTodo } from 'lucide-react';

interface Todo {
    id: string;
    text: string;
    completed: boolean;
    category: 'urgent' | 'regular' | 'backlog';
    createdAt: number;
}

export function TodoTracker() {
    const [todos, setTodos] = useState<Todo[]>(() => {
        const saved = localStorage.getItem('studybud_todos');
        return saved ? JSON.parse(saved) : [];
    });
    const [inputValue, setInputValue] = useState('');
    const [category, setCategory] = useState<Todo['category']>('regular');

    useEffect(() => {
        localStorage.setItem('studybud_todos', JSON.stringify(todos));
    }, [todos]);

    const addTodo = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const newTodo: Todo = {
            id: crypto.randomUUID(),
            text: inputValue.trim(),
            completed: false,
            category,
            createdAt: Date.now(),
        };

        setTodos([newTodo, ...todos]);
        setInputValue('');
    };

    const toggleTodo = (id: string) => {
        setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTodo = (id: string) => {
        setTodos(todos.filter(t => t.id !== id));
    };

    const categories = [
        { id: 'urgent' as const, label: 'Urgent', color: 'text-red-400', bg: 'bg-red-400/10' },
        { id: 'regular' as const, label: 'Regular', color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
        { id: 'backlog' as const, label: 'Backlog', color: 'text-gray-400', bg: 'bg-slate-800/5' },
    ];

    return (
        <div className="p-10 text-slate-100 max-w-3xl mx-auto min-h-full bg-slate-900/20">
            <div className="flex items-center gap-6 mb-12">
                <div className="w-16 h-16 bg-neo-accent border border-white/10 flex items-center justify-center shadow-neo -rotate-6">
                    <ListTodo className="text-white w-8 h-8 stroke-[3px]" />
                </div>
                <div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic leading-none">STUDY TASKS</h2>
                    <p className="text-[10px] font-black text-slate-100/40 uppercase tracking-[0.2em] mt-2 italic">PROTOCOL: ORGANIZATION_SEQUENCE</p>
                </div>
            </div>

            <form onSubmit={addTodo} className="space-y-6 mb-12">
                <div className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="DEFINE NEW OBJECTIVE..."
                        className="flex-1 bg-slate-800 border border-white/10 px-6 py-4 font-black uppercase tracking-tight italic text-lg focus:bg-neo-secondary outline-none transition-all placeholder:text-slate-100/20 shadow-neo"
                    />
                    <button
                        type="submit"
                        className="bg-slate-900 text-white px-10 py-4 border border-white/10 font-black uppercase italic tracking-tighter text-xl hover:bg-neo-accent hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-neo flex items-center justify-center gap-3"
                    >
                        <Plus className="w-6 h-6 stroke-[4px]" />
                        ADD
                    </button>
                </div>

                <div className="flex flex-wrap gap-4">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`
                                px-6 py-2 border border-white/10 font-black uppercase text-[10px] tracking-widest transition-all 
                                ${category === cat.id
                                    ? `bg-neo-secondary shadow-neo -translate-y-1`
                                    : 'bg-slate-800 hover:bg-neo-muted hover:shadow-neo'
                                }
                            `}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </form>

            <div className="space-y-6">
                {todos.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800 border border-dashed border-white/10/10 rotate-1">
                        <Target className="w-16 h-16 text-slate-100/10 mx-auto mb-6" />
                        <p className="font-black text-slate-100/20 uppercase tracking-[0.3em] text-sm">NO ACTIVE TARGETS FOUND</p>
                    </div>
                ) : (
                    todos.sort((a, b) => {
                        if (a.completed !== b.completed) return a.completed ? 1 : -1;
                        return b.createdAt - a.createdAt;
                    }).map((todo, idx) => (
                        <div
                            key={todo.id}
                            className={`
                                group flex items-center gap-6 p-6 border border-white/10 transition-all duration-200 
                                ${todo.completed
                                    ? 'bg-neo-muted/30 border-white/10/20 opacity-50 shadow-none'
                                    : 'bg-slate-800 shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo'
                                }
                                ${idx % 2 === 0 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'}
                            `}
                        >
                            <button
                                onClick={() => toggleTodo(todo.id)}
                                className={`
                                    w-10 h-10 border border-white/10 flex items-center justify-center transition-all
                                    ${todo.completed ? 'bg-neo-secondary' : 'bg-slate-800 hover:bg-neo-muted'}
                                `}
                            >
                                {todo.completed ? <CheckCircle2 className="w-6 h-6 stroke-[4px]" /> : <Circle className="w-6 h-6 stroke-[3px]" />}
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className={`text-xl font-black uppercase tracking-tight italic transition-all ${todo.completed ? 'line-through text-slate-100/40' : 'text-slate-100'}`}>
                                    {todo.text}
                                </p>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className={`px-2 py-0.5 border border-white/10 font-black uppercase text-[8px] tracking-widest ${todo.category === 'urgent' ? 'bg-neo-accent text-white' :
                                        todo.category === 'regular' ? 'bg-neo-secondary' : 'bg-neo-muted'
                                        }`}>
                                        {todo.category}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-100/40 uppercase tracking-widest italic">
                                        TIMESTAMP: {new Date(todo.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => deleteTodo(todo.id)}
                                className="p-3 border border-white/10 bg-slate-800 hover:bg-neo-accent hover:text-white transition-all active:shadow-none shadow-neo"
                            >
                                <Trash2 className="w-5 h-5 stroke-[3px]" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

}
