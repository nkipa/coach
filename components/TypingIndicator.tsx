import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-6 w-full animate-fade-in">
      <div className="bg-trackit-panel border border-trackit-border rounded-2xl rounded-bl-none px-6 py-4 flex items-center space-x-1 w-20">
        <div className="w-2 h-2 bg-trackit-muted rounded-full typing-dot"></div>
        <div className="w-2 h-2 bg-trackit-muted rounded-full typing-dot"></div>
        <div className="w-2 h-2 bg-trackit-muted rounded-full typing-dot"></div>
      </div>
    </div>
  );
};

export default TypingIndicator;