import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Поправь путь к своему конфигу supabase, если он другой

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setUsers(data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleRole = async (userId, field, currentValue) => {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: !currentValue })
      .eq('id', userId);
    
    if (!error) fetchUsers();
  };

  return (
    <div className="p-4 bg-slate-900 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Допуски сотрудников</h2>
      <div className="grid gap-3">
        {users.map(user => (
          <div key={user.id} className="p-3 bg-slate-800 rounded flex flex-col md:flex-row md:items-center justify-between gap-2 border border-slate-700">
            <div className="font-medium text-white">{user.full_name}</div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={user.can_design || false} onChange={() => toggleRole(user.id, 'can_design', user.can_design)} className="accent-blue-500" />
                🎨 Дизайн
              </label>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={user.can_print || false} onChange={() => toggleRole(user.id, 'can_print', user.can_print)} className="accent-blue-500" />
                🖨 Печать
              </label>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={user.can_install || false} onChange={() => toggleRole(user.id, 'can_install', user.can_install)} className="accent-blue-500" />
                🛠 Монтаж
              </label>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer hover:text-white">
                <input type="checkbox" checked={user.is_admin || false} onChange={() => toggleRole(user.id, 'is_admin', user.is_admin)} className="accent-red-500" />
                👑 Админ
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}