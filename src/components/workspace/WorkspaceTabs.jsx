import React from 'react';

const WorkspaceTabs = ({ tabs, activeTab, onTabClick }) => {
  return (
    <div className="flex border-b border-gray-200 bg-white overflow-x-auto px-2">
      {tabs.map(tab => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onTabClick(tab)}
            className={`px-6 py-4 text-sm font-extrabold border-b-[3px] transition-all whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-700 bg-blue-50/20' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
          >
            {tab.replace('_', ' ')}
          </button>
        );
      })}
    </div>
  );
};

export default WorkspaceTabs;
