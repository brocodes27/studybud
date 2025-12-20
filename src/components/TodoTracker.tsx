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
        { id: 'backlog' as const, label: 'Backlog', color: 'text-gray-400', bg: 'bg-white/5' },
    ];

    return (
        <div className="p-8 text-white max-w-2xl mx-auto min-h-[500px]">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-neon-purple/20 rounded-xl flex items-center justify-center">
                    <ListTodo className="text-neon-purple w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Study Tasks</h2>
                    <p className="text-gray-400 text-sm">Organize your academic goals</p>
                </div>
            </div>

            <form onSubmit={addTodo} className="space-y-4 mb-8">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="What do you need to study?"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none transition-all placeholder:text-gray-600"
                    />
                    <button
                        type="submit"
                        className="bg-neon-purple hover:bg-purple-600 text-white px-6 rounded-xl transition-all shadow-lg shadow-neon-purple/20 flex items-center gap-2 font-bold"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden md:inline">Add</span>
                    </button>
                </div>

                <div className="flex gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all border ${category === cat.id
                                ? `border-white/20 ${cat.bg} ${cat.color} scale-105`
                                : 'border-transparent bg-white/5 text-gray-500 hover:bg-white/10'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </form>

            <div className="space-y-3">
                {todos.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <Target className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-50" />
                        <p className="text-gray-500">No tasks yet. Start by adding one above!</p>
                    </div>
                ) : (
                    todos.sort((a, b) => {
                        if (a.completed !== b.completed) return a.completed ? 1 : -1;
                        return b.createdAt - a.createdAt;
                    }).map((todo) => (
                        <div
                            key={todo.id}
                            className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${todo.completed
                                ? 'bg-black/20 border-white/5 opacity-60'
                                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                                }`}
                        >
                            <button
                                onClick={() => toggleTodo(todo.id)}
                                className={`transition-colors ${todo.completed ? 'text-neon-green' : 'text-gray-500 hover:text-white'}`}
                            >
                                {todo.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm md:text-base truncate transition-all ${todo.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                    {todo.text}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] uppercase tracking-wider font-bold ${categories.find(c => c.id === todo.category)?.color
                                        }`}>
                                        {todo.category}
                                    </span>
                                    <span className="text-[10px] text-gray-600">•</span>
                                    <span className="text-[10px] text-gray-600">
                                        {new Date(todo.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => deleteTodo(todo.id)}
                                className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
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
