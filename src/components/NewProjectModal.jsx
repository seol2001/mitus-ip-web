import React, { useState } from 'react';
import { X, Plus, FolderPlus } from 'lucide-react';
import { foundryProcessMap } from '../data/mockData';

const lc = "block text-[13px] font-medium text-gray-600 mb-1.5";
const ic = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed";

export default function NewProjectModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    Project_Name: '',
    Customer_Name: '',
    Target_Application: '',
    Foundry: '',
    Process: '',
    IP_Blocks: []
  });
  
  const [ipInput, setIpInput] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'Foundry') {
        newData.Process = (foundryProcessMap[value] || [])[0] || '';
      }
      return newData;
    });
  };

  const handleIpKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = ipInput.trim();
      if (val && !formData.IP_Blocks.includes(val)) {
        setFormData(prev => ({
          ...prev,
          IP_Blocks: [...prev.IP_Blocks, val]
        }));
      }
      setIpInput('');
    }
  };

  const removeIp = (ipToRemove) => {
    setFormData(prev => ({
      ...prev,
      IP_Blocks: prev.IP_Blocks.filter(ip => ip !== ipToRemove)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.Project_Name.trim()) return;
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FolderPlus className="text-blue-600" size={20} />
            새 프로젝트 생성
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="new-project-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={lc}>Project Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="Project_Name" 
                value={formData.Project_Name} 
                onChange={handleChange} 
                className={ic} 
                placeholder="프로젝트 이름을 입력하세요"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Customer</label>
                <input 
                  type="text" 
                  name="Customer_Name" 
                  value={formData.Customer_Name} 
                  onChange={handleChange} 
                  className={ic} 
                  placeholder="ex) Samsung"
                />
              </div>
              <div>
                <label className={lc}>Application</label>
                <input 
                  type="text" 
                  name="Target_Application" 
                  value={formData.Target_Application} 
                  onChange={handleChange} 
                  className={ic} 
                  placeholder="ex) Mobile"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Foundry</label>
                <select name="Foundry" value={formData.Foundry} onChange={handleChange} className={ic}>
                  <option value="">선택 안함</option>
                  {Object.keys(foundryProcessMap || {}).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lc}>Process</label>
                <select name="Process" value={formData.Process} onChange={handleChange} className={ic} disabled={!formData.Foundry}>
                  <option value="">{formData.Foundry ? "선택하세요" : "Foundry를 먼저 선택하세요"}</option>
                  {(foundryProcessMap[formData.Foundry] || []).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={lc}>IP Blocks</label>
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={ipInput} 
                  onChange={(e) => setIpInput(e.target.value)} 
                  onKeyDown={handleIpKeyDown}
                  className={ic} 
                  placeholder="IP 이름을 입력하고 Enter를 누르세요"
                />
                
                {formData.IP_Blocks.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg min-h-[50px]">
                    {formData.IP_Blocks.map(ip => (
                      <span key={ip} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 text-blue-700 text-sm font-semibold rounded-full shadow-sm">
                        {ip}
                        <button 
                          type="button"
                          onClick={() => removeIp(ip)} 
                          className="text-blue-400 hover:text-red-500 transition-colors focus:outline-none"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">프로젝트에 포함될 IP들을 입력하세요.</p>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="new-project-form"
            disabled={!formData.Project_Name.trim()}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      </div>
    </div>
  );
}
