
import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { CalendarEvent, Task, TaskStatus, TaskPriority, ContractCategory } from '../types';

type ViewMode = 'month' | 'week';

interface CalendarItem {
    id: string;
    type: 'event' | 'task';
    title: string;
    date: string; // YYYY-MM-DD
    time?: string;
    data: CalendarEvent | Task;
}

export const CalendarPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Data
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Drag & Drop State
  const [draggedItem, setDraggedItem] = useState<CalendarItem | null>(null);

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Initialize
  useEffect(() => {
    refreshData();
    checkIntegrationStatus();
  }, []);

  const refreshData = () => {
    const events = db.getAll<CalendarEvent>('events');
    const tasks = db.getAll<Task>('tasks');
    setCategories(db.getAll('contract_categories'));

    const mappedEvents: CalendarItem[] = events.map(e => ({
        id: e.id,
        type: 'event',
        title: e.title,
        date: e.date,
        time: e.start_time,
        data: e
    }));

    const mappedTasks: CalendarItem[] = tasks.filter(t => t.status !== TaskStatus.COMPLETED).map(t => ({
        id: t.id,
        type: 'task',
        title: t.title,
        date: t.due_date,
        data: t
    }));

    setCalendarItems([...mappedEvents, ...mappedTasks]);
  };

  const checkIntegrationStatus = () => {
      const integration = db.getIntegration('google_calendar');
      if (integration?.is_connected) {
          setIsGoogleConnected(true);
      }
  };

  // --- Date Helpers ---

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days: (Date | null)[] = [];
    const firstDayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1; // Mon=0
    
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const getDaysInWeek = (current: Date) => {
      const week = [];
      // Calculate Monday of the current week
      const first = current.getDate() - current.getDay() + 1;
      const monday = new Date(current.setDate(first)); // This mutates current, be careful
      
      // Reset current to avoid side effects in rendering
      const startOfWeek = new Date(current); 
      const day = startOfWeek.getDay() || 7; 
      if(day !== 1) startOfWeek.setHours(-24 * (day - 1));

      for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          week.push(d);
      }
      return week;
  };

  const getItemsForDate = (date: Date) => {
      if (!date) return [];
      const dateStr = date.toISOString().split('T')[0];
      return calendarItems.filter(i => i.date === dateStr);
  };

  const getCategoryName = (id?: string) => {
      if (!id) return null;
      return categories.find(c => c.id === id)?.name;
  };

  // --- Handlers ---

  const handleConnectGoogle = () => {
    setIsSyncing(true);
    setTimeout(() => {
        db.setIntegration('google_calendar', true);
        setIsGoogleConnected(true);
        setIsSyncing(false);
        // In a real app, this would fetch events. 
        // For this demo, we assume the mock DB already has 'google' source events seeded or created.
        refreshData();
    }, 1500);
  };

  const handleDisconnectGoogle = () => {
      if(window.confirm('Disconnect Google Calendar?')) {
          db.setIntegration('google_calendar', false);
          setIsGoogleConnected(false);
          // In real app, filter out google source events
      }
  };

  // Drag & Drop
  const handleDragStart = (item: CalendarItem) => {
      setDraggedItem(item);
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      if (!draggedItem) return;

      const newDateStr = targetDate.toISOString().split('T')[0];

      if (draggedItem.type === 'event') {
          db.update<CalendarEvent>('events', draggedItem.id, { date: newDateStr });
      } else {
          db.update<Task>('tasks', draggedItem.id, { due_date: newDateStr });
      }
      
      refreshData();
      setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Click & Edit
  const handleItemClick = (item: CalendarItem) => {
      if (item.type === 'event') {
          setSelectedEvent(item.data as CalendarEvent);
          setIsEventModalOpen(true);
      } else {
          setSelectedTask(item.data as Task);
          setIsTaskModalOpen(true);
      }
  };

  const handleCreateEvent = () => {
      setSelectedEvent({
          id: '',
          tenant_id: 'demo',
          title: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
          start_time: '09:00',
          end_time: '10:00',
          location: '',
          event_type: 'Meeting',
          source: 'local',
          created_at: ''
      });
      setIsEventModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedEvent) return;
      const fd = new FormData(e.target as HTMLFormElement);
      const updates: any = {
          title: fd.get('title'),
          date: fd.get('date'),
          start_time: fd.get('start_time'),
          end_time: fd.get('end_time'),
          location: fd.get('location'),
          description: fd.get('description'),
          event_type: fd.get('event_type'),
      };

      if (selectedEvent.id) {
          if (selectedEvent.source === 'local') db.update<CalendarEvent>('events', selectedEvent.id, updates);
      } else {
          db.create('events', { ...selectedEvent, ...updates, created_at: new Date().toISOString(), source: 'local' });
      }
      setIsEventModalOpen(false);
      refreshData();
  };

  const handleDeleteEvent = () => {
      if (selectedEvent?.id && confirm('Delete event?')) {
          db.delete('events', selectedEvent.id);
          setIsEventModalOpen(false);
          refreshData();
      }
  };

  const handleSaveTask = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTask) return;
      const fd = new FormData(e.target as HTMLFormElement);
      
      db.update<Task>('tasks', selectedTask.id, {
          title: fd.get('title') as string,
          status: fd.get('status') as TaskStatus,
          due_date: fd.get('due_date') as string,
          priority: fd.get('priority') as TaskPriority,
          category_id: fd.get('category_id') as string || undefined
      });
      
      setIsTaskModalOpen(false);
      refreshData();
  };

  // --- Render ---

  const currentMonthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const renderCalendarItem = (item: CalendarItem, isCompact = false) => {
      const isTask = item.type === 'task';
      const isGoogle = !isTask && (item.data as CalendarEvent).source === 'google';
      const eventType = !isTask ? (item.data as CalendarEvent).event_type : null;
      const taskCategoryName = isTask ? getCategoryName((item.data as Task).category_id) : null;

      let bgClass = '';
      let borderClass = '';
      let textClass = '';

      if (isTask) {
          bgClass = 'bg-green-50 hover:bg-green-100';
          borderClass = 'border-green-200';
          textClass = 'text-green-800';
      } else if (isGoogle) {
          bgClass = 'bg-orange-50 hover:bg-orange-100';
          borderClass = 'border-orange-200';
          textClass = 'text-orange-800';
      } else if (eventType === 'Court') {
          bgClass = 'bg-red-50 hover:bg-red-100';
          borderClass = 'border-red-200';
          textClass = 'text-red-800';
      } else {
          bgClass = 'bg-blue-50 hover:bg-blue-100';
          borderClass = 'border-blue-200';
          textClass = 'text-blue-800';
      }

      return (
        <div 
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(item)}
            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} 
            className={`
                px-2 py-1.5 rounded text-xs border font-medium cursor-grab active:cursor-grabbing shadow-sm transition-transform hover:-translate-y-0.5
                ${bgClass} ${borderClass} ${textClass}
                mb-1
            `}
            title={item.title}
        >
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                    {isTask ? (
                        <Icons.CheckSquare size={10} className="opacity-70 flex-shrink-0" />
                    ) : (
                        <span className="opacity-75 text-[10px] w-8 flex-shrink-0">{item.time}</span>
                    )}
                    <span className="truncate flex-1">{item.title}</span>
                    {isGoogle && <span className="text-[8px] font-black bg-white/50 px-1 rounded">G</span>}
                </div>
                {taskCategoryName && (
                    <span className="text-[9px] opacity-75 truncate block">
                        • {taskCategoryName}
                    </span>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
                <p className="text-gray-500 text-sm mt-1">{currentMonthName}</p>
            </div>
            
            {/* View Toggle */}
            <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button 
                    onClick={() => setViewMode('month')} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Month
                </button>
                <button 
                    onClick={() => setViewMode('week')} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Week
                </button>
            </div>
        </div>

        <div className="flex items-center gap-3">
             {/* Navigation */}
             <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-gray-50 text-gray-600 border-r border-gray-200"><Icons.ChevronRight className="rotate-180" size={16} /></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">Today</button>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-gray-50 text-gray-600 border-l border-gray-200"><Icons.ChevronRight size={16} /></button>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-1"></div>
            
            {!isGoogleConnected ? (
                <button 
                    onClick={handleConnectGoogle}
                    disabled={isSyncing}
                    className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                    {isSyncing ? <Icons.Sparkles className="animate-spin" size={14} /> : <Icons.Upload size={14} />}
                    Sync Google
                </button>
            ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> Google Synced
                </span>
            )}

            <button onClick={handleCreateEvent} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-sm">
                <Icons.Plus size={16} /> New Event
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Days Header */}
        <div className={`grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-shrink-0`}>
            {weekDays.map(d => (
                <div key={d} className="p-3 text-center text-xs font-bold uppercase text-gray-500 tracking-wider">{d}</div>
            ))}
        </div>

        {viewMode === 'month' ? (
            /* Month View Grid */
            <div className="grid grid-cols-7 grid-rows-5 h-full bg-gray-200 gap-px">
                {getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()).map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="bg-gray-50/50"></div>;
                    const dateItems = getItemsForDate(day);
                    const isToday = new Date().toDateString() === day.toDateString();

                    return (
                        <div 
                            key={day.toISOString()} 
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day)}
                            className={`bg-white p-2 transition-colors hover:bg-gray-50 flex flex-col gap-1 overflow-hidden ${isToday ? 'bg-blue-50/10' : ''}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700'}`}>
                                    {day.getDate()}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {dateItems.map(item => renderCalendarItem(item))}
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            /* Week View Columns */
            <div className="grid grid-cols-7 h-full bg-white divide-x divide-gray-100">
                {getDaysInWeek(new Date(currentDate)).map((day) => {
                    const dateItems = getItemsForDate(day);
                    const isToday = new Date().toDateString() === day.toDateString();
                    
                    return (
                        <div 
                            key={day.toISOString()}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day)}
                            className={`flex flex-col h-full hover:bg-gray-50/50 transition-colors ${isToday ? 'bg-blue-50/20' : ''}`}
                        >
                            <div className="p-3 text-center border-b border-gray-100">
                                <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</span>
                            </div>
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                {dateItems.length === 0 && (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed border-transparent hover:border-gray-200 rounded-lg transition-all">
                                        <p className="text-[10px] text-gray-300 font-medium">Drop here</p>
                                    </div>
                                )}
                                {dateItems.map(item => renderCalendarItem(item))}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* Event Details Modal */}
      {isEventModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-5">
                    <h2 className="text-lg font-bold text-gray-900">
                        {selectedEvent.id ? 'Edit Event' : 'New Event'}
                    </h2>
                    <button onClick={() => setIsEventModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                </div>
                <form onSubmit={handleSaveEvent} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                        <input name="title" required defaultValue={selectedEvent.title} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-900 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                            <input type="date" name="date" required defaultValue={selectedEvent.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                             <select name="event_type" defaultValue={selectedEvent.event_type} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                 <option value="Meeting">Meeting</option>
                                 <option value="Call">Call</option>
                                 <option value="Court">Court</option>
                                 <option value="Internal">Internal</option>
                             </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start</label>
                            <input type="time" name="start_time" defaultValue={selectedEvent.start_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End</label>
                            <input type="time" name="end_time" defaultValue={selectedEvent.end_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                        <input name="location" defaultValue={selectedEvent.location} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Add location..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                        <textarea name="description" rows={3} defaultValue={selectedEvent.description} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Notes..." />
                    </div>
                    <div className="flex justify-between pt-4 border-t border-gray-100 mt-2">
                        {selectedEvent.id && <button type="button" onClick={handleDeleteEvent} className="text-red-600 text-sm font-medium hover:underline">Delete Event</button>}
                        <div className="flex gap-2 ml-auto">
                            <button type="button" onClick={() => setIsEventModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">Save</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Task Edit Modal (Simplified) */}
      {isTaskModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Icons.CheckSquare size={20} className="text-gray-500" />
                        Edit Task
                    </h2>
                    <button onClick={() => setIsTaskModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                </div>
                <form onSubmit={handleSaveTask} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task Title</label>
                        <input name="title" required defaultValue={selectedTask.title} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-900 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                        <input type="date" name="due_date" required defaultValue={selectedTask.due_date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                             <select name="status" defaultValue={selectedTask.status} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                 {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                             <select name="priority" defaultValue={selectedTask.priority} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                 {Object.values(TaskPriority).map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                        </div>
                    </div>
                    
                    <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                         <select name="category_id" defaultValue={selectedTask.category_id || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                             <option value="">-- None --</option>
                             {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800">Save Task</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};
