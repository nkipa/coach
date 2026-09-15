import React from 'react';
import { Framework } from '../types';

interface FrameworkCardProps {
  framework: Framework;
  onSelect: (framework: Framework) => void;
  isEditing?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const FrameworkCard: React.FC<FrameworkCardProps> = ({ 
  framework, 
  onSelect, 
  isEditing = false,
  onDragStart,
  onDragEnter,
  onDragEnd
}) => {
  return (
    <div 
      draggable={isEditing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onClick={() => !isEditing && onSelect(framework)}
      className={`
        bg-trackit-panel border rounded-xl p-5 flex flex-col h-full transition-all duration-200 group relative
        ${isEditing 
          ? 'border-dashed border-trackit-muted/50 cursor-move hover:bg-trackit-panel/50 animate-pulse' 
          : 'border-trackit-border hover:border-trackit-accent cursor-pointer hover:shadow-lg hover:shadow-trackit-accent/10'
        }
      `}
    >
      {isEditing && (
        <div className="absolute top-2 right-2 text-trackit-muted">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-3">
        <span className={`text-3xl ${isEditing ? 'opacity-50' : ''}`}>{framework.icon}</span>
        <span className="text-[10px] font-mono text-trackit-muted bg-trackit-dark px-2 py-0.5 rounded">
          {framework.persona}
        </span>
      </div>
      <h3 className={`text-lg font-bold text-trackit-text mb-1.5 transition-colors ${!isEditing && 'group-hover:text-trackit-accent'}`}>
        {framework.name}
      </h3>
      <p className="text-trackit-muted text-xs mb-3 flex-grow leading-relaxed">
        {framework.description}
      </p>
      <div className="mt-auto pt-3 border-t border-trackit-border">
        <p className="text-[10px] text-trackit-muted font-semibold uppercase tracking-wider mb-1.5">Methodology:</p>
        <div className="flex flex-wrap gap-1.5">
          {framework.steps.map((step, idx) => (
            <span key={idx} className="text-[9px] bg-trackit-dark text-trackit-muted px-1.5 py-0.5 rounded-full border border-trackit-border">
              {idx + 1}. {step.split(':')[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FrameworkCard;