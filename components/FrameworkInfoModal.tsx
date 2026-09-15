import React from 'react';
import { FRAMEWORKS } from '../constants';

interface FrameworkInfoModalProps {
  onClose: () => void;
}

// Extended details for the info page that aren't in the main config
const FRAMEWORK_DETAILS: Record<string, { useCases: string[], bestFor: string, example: string }> = {
  'simple_chat': {
    bestFor: "General conversation, quick questions, and unstructured tasks.",
    useCases: [
      "Casual conversation.",
      "General knowledge questions.",
      "Simple drafting or editing.",
      "Topics that don't fit other frameworks."
    ],
    example: "\"Hello, how are you today?\" or \"What is the capital of France?\""
  },
  'direct_ai': {
    bestFor: "Complex reasoning, coding, and open-ended strategy.",
    useCases: [
      "Drafting difficult emails to investors or stakeholders.",
      "Debugging complex code snippets or architectural decisions.",
      "Brainstorming marketing angles without a rigid structure.",
      "Simulating a debate with a contrarian perspective."
    ],
    example: "\"I need to pivot my business model but I'm afraid of alienating current users. Act as a strategist and analyze my risks.\""
  },
  'quick_sync': {
    bestFor: "Speed, low-latency checks, and simple tasks.",
    useCases: [
      "Grammar and tone checks on short messages.",
      "Quick fact-checking or definition lookups.",
      "Generating a quick list of ideas (quantity over quality).",
      "Translating a phrase or summarizing a short paragraph."
    ],
    example: "\"Quickly summarize this slack message into 3 bullet points.\""
  },
  'first_principles': {
    bestFor: "Solving stubborn problems where 'best practices' have failed.",
    useCases: [
      "Radical innovation (Zero to One).",
      "Optimizing systems to their theoretical physical limits.",
      "Questioning industry standards or 'rules of thumb'.",
      "Complex engineering or architectural challenges."
    ],
    example: "\"Batteries are expensive. Break down the cost of the constituent materials to find the floor price.\""
  },
  'smart_waterfall': {
    bestFor: "Turning vague ideas into rigid, step-by-step project plans.",
    useCases: [
      "Planning a software launch (Requirements -> Design -> Dev -> QA).",
      "Organizing a physical event like a conference or wedding.",
      "Structuring a research paper or thesis timeline.",
      "Creating a JSON file to import into Jira/Asana/Trello."
    ],
    example: "\"I want to launch a podcast in 30 days. Break this down into a Waterfall plan with hour estimates.\""
  },
  'life_design': {
    bestFor: "Holistic alignment of personal values, health, and wealth.",
    useCases: [
      "Conducting a 'Life Audit' to find where you are leaking energy.",
      "Setting New Year's resolutions that actually stick.",
      "Designing a morning routine that balances productivity and health.",
      "Navigating a mid-life crisis or major personal pivot."
    ],
    example: "\"I feel successful at work but my health is suffering. Help me design a routine that fixes this.\""
  },
  'career_velocity': {
    bestFor: "Corporate navigation, promotions, and job switching.",
    useCases: [
      "Preparing for a high-stakes performance review.",
      "Negotiating a salary increase or equity package.",
      "Planning a pivot from one industry (e.g., Law) to another (e.g., Tech).",
      "Navigating office politics and conflict resolution."
    ],
    example: "\"I want to be promoted to Senior Manager by Q4. Create a skill-gap analysis and execution plan.\""
  },
  'startup_lean': {
    bestFor: "Validating business ideas and finding Product-Market Fit.",
    useCases: [
      "Defining the MVP (Minimum Viable Product) feature set.",
      "Creating a Lean Canvas business model.",
      "Drafting cold outreach emails for customer discovery interviews.",
      "Sizing a market (TAM/SAM/SOM) for a pitch deck."
    ],
    example: "\"I have an idea for 'Uber for Dog Walkers'. Help me validate if this is a real problem before I build it.\""
  },
  'sot_auditor': {
    bestFor: "Post-mortem analysis, timeline reconstruction, and forensic review.",
    useCases: [
      "Analyzing a pasted log of a project failure to find the root cause.",
      "Reviewing a chat history to create a 'Source of Truth' timeline.",
      "Auditing a process to find inefficiencies.",
      "Summarizing a long meeting transcript into actionable facts."
    ],
    example: "\"Here are the server logs and Slack messages from the outage. Generate a Root Cause Analysis report.\""
  }
};

const FrameworkInfoModal: React.FC<FrameworkInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-trackit-dark border border-trackit-border rounded-2xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-trackit-border bg-trackit-panel flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-trackit-text flex items-center gap-3">
              <span>📚</span> Framework Guide & Use Cases
            </h2>
            <p className="text-trackit-muted text-sm mt-1">Select the right intelligence model for your specific objective.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-trackit-border rounded-full text-trackit-muted hover:text-trackit-text transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-trackit-dark scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FRAMEWORKS.map((fw) => {
              const details = FRAMEWORK_DETAILS[fw.id] || { useCases: [], bestFor: "General tasks.", example: "" };
              
              return (
                <div key={fw.id} className="bg-trackit-panel border border-trackit-border rounded-xl p-6 flex flex-col hover:border-trackit-muted transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-4xl">{fw.icon}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider bg-trackit-dark px-2 py-1 rounded text-trackit-accent border border-trackit-border">
                      {fw.persona}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-trackit-text mb-2">{fw.name}</h3>
                  <p className="text-sm text-trackit-muted mb-4 border-b border-trackit-border pb-4">
                    {fw.description}
                  </p>

                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-trackit-text uppercase tracking-wider mb-2 flex items-center gap-1">
                      <span>⚡</span> Best For
                    </h4>
                    <p className="text-sm text-trackit-text/80">{details.bestFor}</p>
                  </div>

                  <div className="mb-4 flex-1">
                    <h4 className="text-xs font-bold text-trackit-text uppercase tracking-wider mb-2 flex items-center gap-1">
                      <span>🎯</span> Use Cases
                    </h4>
                    <ul className="space-y-1.5">
                      {details.useCases.map((useCase, idx) => (
                        <li key={idx} className="text-xs text-trackit-muted flex items-start gap-2">
                          <span className="text-trackit-accent mt-0.5">•</span>
                          <span>{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-trackit-dark/50 rounded-lg p-3 border border-trackit-border mt-auto">
                    <h4 className="text-[10px] font-bold text-trackit-muted uppercase mb-1">Example Prompt</h4>
                    <p className="text-xs italic text-trackit-text/70">"{details.example}"</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-trackit-border bg-trackit-panel shrink-0 text-center">
             <p className="text-xs text-trackit-muted">Pro Tip: You can switch frameworks in the dashboard without losing your account history, but each session is tied to one framework.</p>
        </div>

      </div>
    </div>
  );
};

export default FrameworkInfoModal;