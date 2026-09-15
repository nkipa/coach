import React, { useState } from 'react';

interface EditableTitleProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  inputClassName?: string;
}

const EditableTitle: React.FC<EditableTitleProps> = ({ initialValue, onSave, onCancel, inputClassName }) => {
  const [value, setValue] = useState(initialValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onSave(value);
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
        <input 
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          autoFocus
          onClick={e => e.stopPropagation()}
        />
        <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(value); }}
            className="p-1 text-green-400 hover:text-green-300 hover:bg-slate-800 rounded transition-colors flex-shrink-0"
            title="Save (Enter)"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
               <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        </button>
        <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }} 
            className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors flex-shrink-0"
            title="Cancel (Esc)"
        >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
        </button>
    </div>
  );
};

export default EditableTitle;