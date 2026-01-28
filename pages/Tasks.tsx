
import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { Task, TaskStatus, TaskPriority, SubTask, TaskComment, Client, User, ContractCategory } from '../types';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]); 
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  
  // Drawer / Detail View State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Drawer Local Edits State
  const [commentInput, setCommentInput] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');

  const refreshData = () => {
    setTasks(db.getAll('tasks'));
    setClients(db.getAll('clients'));
    setUsers(db.getAll('users'));
    setCategories(db.getAll('contract_categories'));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const getFilteredTasks = () => {
      if (filterCategory === 'ALL') return tasks;
      return tasks.filter(t => t.category_id === filterCategory);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    const id = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === id);
    if (task && task.status !== status) {
       db.update<Task>('tasks', id, { status });
       refreshData();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // --- Task Creation ---
  const handleCreateTask = (e: React.FormEvent) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      
      const newTask = {
          title: fd.get('title') as string,
          description: fd.get('description') as string,
          priority: fd.get('priority') as TaskPriority,
          due_date: fd.get('due_date') as string,
          related_client_id: fd.get('client_id') as string || undefined,
          category_id: fd.get('category_id') as string || undefined,
          assigned_to: fd.get('assigned_to') as string || 'user-1',
          status: TaskStatus.TODO,
          time_spent_minutes: 0,
          subtasks: [],
          comments: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      };

      db.create('tasks', newTask as any);
      refreshData();
      setIsCreateModalOpen(false);
  };


  // --- Task Detail Logic ---

  const openTaskDrawer = (task: Task) => {
      setSelectedTask(task);
      setIsDrawerOpen(true);
  };

  const closeTaskDrawer = () => {
      setIsDrawerOpen(false);
      setSelectedTask(null);
      refreshData();
  };

  const handleSaveDetailChanges = () => {
      if (!selectedTask) return;
      db.update<Task>('tasks', selectedTask.id, selectedTask);
      closeTaskDrawer();
  };

  const handleAddSubtask = () => {
      if (!selectedTask || !subtaskInput.trim()) return;
      const newSubtask: SubTask = {
          id: Math.random().toString(36).substr(2, 9),
          title: subtaskInput,
          is_completed: false
      };
      const updatedSubtasks = [...(selectedTask.subtasks || []), newSubtask];
      
      // Update local state immediately for UI
      const updatedTask = { ...selectedTask, subtasks: updatedSubtasks };
      setSelectedTask(updatedTask);
      setSubtaskInput('');
      
      // Persist
      db.update<Task>('tasks', selectedTask.id, { subtasks: updatedSubtasks });
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));
  };

  const toggleSubtask = (subtaskId: string) => {
      if (!selectedTask) return;
      const updatedSubtasks = (selectedTask.subtasks || []).map(st => 
          st.id === subtaskId ? { ...st, is_completed: !st.is_completed } : st
      );
      const updatedTask = { ...selectedTask, subtasks: updatedSubtasks };
      setSelectedTask(updatedTask);
      db.update<Task>('tasks', selectedTask.id, { subtasks: updatedSubtasks });
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));
  };

  const handleAddComment = () => {
      if (!selectedTask || !commentInput.trim()) return;
      const newComment: TaskComment = {
          id: Math.random().toString(36).substr(2, 9),
          user_id: 'user-1', 
          user_name: 'John Doe',
          content: commentInput,
          created_at: new Date().toISOString()
      };
      const updatedComments = [...(selectedTask.comments || []), newComment];
      
      const updatedTask = { ...selectedTask, comments: updatedComments };
      setSelectedTask(updatedTask);
      setCommentInput('');
      
      db.update<Task>('tasks', selectedTask.id, { comments: updatedComments });
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));
  };

  const getUserInitials = (userId: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) return '??';
      return user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  };

  const getCategoryName = (id?: string) => {
      if(!id) return null;
      return categories.find(c => c.id === id)?.name;
  };

  const filteredTasks = getFilteredTasks();
  const Columns = [
    { title: 'To Do', status: TaskStatus.TODO },
    { title: 'In Progress', status: TaskStatus.IN_PROGRESS },
    { title: 'Completed', status: TaskStatus.COMPLETED },
  ];

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        
        <div className="flex items-center gap-3">
             {/* Category Filter */}
             <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg text-sm px-3 py-2 cursor-pointer focus:ring-2 focus:ring-gray-900"
            >
                <option value="ALL">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
            >
            <Icons.Plus size={16} /> New Task
            </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {Columns.map(col => (
          <div 
            key={col.status} 
            className="flex-1 min-w-[300px] bg-gray-100/50 rounded-xl p-4 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
                {col.title}
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {filteredTasks.filter(t => t.status === col.status).length}
                </span>
            </h3>
            
            <div className="flex-1 space-y-3">
                {filteredTasks.filter(t => t.status === col.status).map(task => {
                    const completedSubtasks = task.subtasks?.filter(st => st.is_completed).length || 0;
                    const totalSubtasks = task.subtasks?.length || 0;
                    const catName = getCategoryName(task.category_id);

                    return (
                        <div 
                            key={task.id} 
                            draggable 
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => openTaskDrawer(task)}
                            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                    task.priority === TaskPriority.URGENT ? 'bg-red-100 text-red-700' :
                                    task.priority === TaskPriority.HIGH ? 'bg-orange-100 text-orange-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {task.priority}
                                </span>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                    <Icons.Edit size={14} />
                                </div>
                            </div>
                            
                            {catName && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mb-2 inline-block">
                                    {catName}
                                </span>
                            )}

                            <h4 className="font-medium text-gray-900 text-sm mb-1">{task.title}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                            
                            {totalSubtasks > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500" 
                                            style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-400">{completedSubtasks}/{totalSubtasks}</span>
                                </div>
                            )}

                            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                                <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                                <div className="flex items-center gap-2">
                                    {(task.comments?.length || 0) > 0 && (
                                        <span className="flex items-center gap-1 text-gray-400">
                                            <Icons.Plus size={10} className="rotate-45" /> {task.comments?.length}
                                        </span>
                                    )}
                                    <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">
                                        {getUserInitials(task.assigned_to)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Task Drawer */}
      {isDrawerOpen && selectedTask && (
          <div className="absolute inset-y-0 right-0 w-[480px] bg-white/95 backdrop-blur shadow-2xl border-l border-gray-200 z-50 flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 ease-out">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                  <div className="flex items-center gap-2">
                      <select 
                        value={selectedTask.status}
                        onChange={(e) => {
                            const newStatus = e.target.value as TaskStatus;
                            setSelectedTask({ ...selectedTask, status: newStatus });
                        }}
                        className="text-xs font-bold uppercase bg-white border border-gray-200 rounded px-2 py-1 cursor-pointer focus:ring-0"
                      >
                          {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center gap-2">
                      <button onClick={handleSaveDetailChanges} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">Save & Close</button>
                      <button onClick={closeTaskDrawer} className="text-gray-400 hover:text-gray-600 p-1"><Icons.Close size={20} /></button>
                  </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  
                  {/* Title & Description */}
                  <div className="space-y-4">
                      <input 
                        value={selectedTask.title}
                        onChange={(e) => setSelectedTask({ ...selectedTask, title: e.target.value })}
                        className="w-full text-2xl font-bold text-gray-900 border-none p-0 focus:ring-0 placeholder-gray-300 bg-transparent"
                        placeholder="Task Title"
                      />
                      <textarea 
                        value={selectedTask.description}
                        onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
                        className="w-full text-sm text-gray-600 border-none p-0 focus:ring-0 resize-none h-24 placeholder-gray-300 bg-transparent leading-relaxed"
                        placeholder="Add a detailed description..."
                      />
                  </div>

                  {/* Properties Grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Assignee</label>
                           <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[9px] font-bold">
                                    {getUserInitials(selectedTask.assigned_to)}
                                </div>
                                <select 
                                    value={selectedTask.assigned_to}
                                    onChange={(e) => setSelectedTask({ ...selectedTask, assigned_to: e.target.value })}
                                    className="text-sm bg-transparent border-none p-0 focus:ring-0 w-full text-gray-900 font-medium cursor-pointer"
                                >
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                           </div>
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Due Date</label>
                          <input 
                            type="date"
                            value={selectedTask.due_date}
                            onChange={(e) => setSelectedTask({ ...selectedTask, due_date: e.target.value })}
                            className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-medium"
                          />
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Priority</label>
                          <select 
                            value={selectedTask.priority}
                            onChange={(e) => setSelectedTask({ ...selectedTask, priority: e.target.value as TaskPriority })}
                            className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-medium cursor-pointer"
                          >
                              {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Linked Client</label>
                          <select 
                            value={selectedTask.related_client_id || ''}
                            onChange={(e) => setSelectedTask({ ...selectedTask, related_client_id: e.target.value || undefined })}
                            className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-medium cursor-pointer truncate"
                          >
                              <option value="">-- None --</option>
                              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                          </select>
                      </div>

                      <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Legal Category</label>
                          <select 
                            value={selectedTask.category_id || ''}
                            onChange={(e) => setSelectedTask({ ...selectedTask, category_id: e.target.value || undefined })}
                            className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-medium cursor-pointer"
                          >
                              <option value="">-- Uncategorized --</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                  </div>

                  {/* Subtasks */}
                  <div>
                      <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                          <Icons.CheckSquare size={14} className="text-gray-400" /> Subtasks
                      </h4>
                      <div className="space-y-2 mb-3">
                          {(selectedTask.subtasks || []).map(st => (
                              <div key={st.id} className="flex items-start gap-3 group bg-white p-2 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                                  <input 
                                    type="checkbox" 
                                    checked={st.is_completed} 
                                    onChange={() => toggleSubtask(st.id)}
                                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className={`text-sm ${st.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                      {st.title}
                                  </span>
                              </div>
                          ))}
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                          <input 
                            value={subtaskInput}
                            onChange={(e) => setSubtaskInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                            placeholder="Add new subtask..." 
                            className="flex-1 text-sm bg-transparent border-none focus:ring-0 placeholder-gray-400"
                          />
                          <button onClick={handleAddSubtask} disabled={!subtaskInput} className="text-gray-400 hover:text-blue-600 disabled:opacity-50"><Icons.Plus size={16} /></button>
                      </div>
                  </div>

                  {/* Comments */}
                  <div>
                      <h4 className="text-xs font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                           Comments
                      </h4>
                      <div className="space-y-4 mb-4">
                          {(selectedTask.comments || []).map(c => (
                              <div key={c.id} className="flex gap-3 text-sm">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-200">
                                      {c.user_name.substring(0,1)}
                                  </div>
                                  <div className="space-y-1">
                                      <div className="flex items-baseline gap-2">
                                          <span className="font-semibold text-gray-900">{c.user_name}</span>
                                          <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <p className="text-gray-600 leading-relaxed">{c.content}</p>
                                  </div>
                              </div>
                          ))}
                          {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                              <p className="text-xs text-gray-400 italic">No comments yet.</p>
                          )}
                      </div>
                      <div className="relative">
                          <input 
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                            placeholder="Write a comment..." 
                            className="w-full text-sm border-gray-200 rounded-lg pl-3 pr-10 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                          <button onClick={handleAddComment} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"><Icons.Sparkles size={16} /></button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Drawer Backdrop */}
      {isDrawerOpen && (
          <div onClick={closeTaskDrawer} className="absolute inset-0 bg-black/20 z-40 backdrop-blur-[1px] animate-in fade-in"></div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold text-gray-900">Create New Task</h2>
                    <button onClick={() => setIsCreateModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                </div>
                
                <form onSubmit={handleCreateTask} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input name="title" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none" placeholder="e.g. Draft NDA" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea name="description" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none resize-none" placeholder="Add details..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select name="priority" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input type="date" name="due_date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                             <select name="assigned_to" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                 {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                             </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select name="category_id" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- None --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Linked Client (Optional)</label>
                        <select name="client_id" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                            <option value="">-- None --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg">Create Task</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};
