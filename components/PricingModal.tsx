import React from 'react';

interface PricingModalProps {
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ onClose }) => {
  
  // LOGIC: Replace these URL placeholders with your actual Stripe Payment Links
  // Go to Stripe Dashboard -> Product Catalog -> Create Product -> Create Payment Link
  const LINKS = {
    starter: '#', // Stays on current page
    pro: 'https://buy.stripe.com/test_pro_link_placeholder', 
    business: 'mailto:sales@agiboss.com?subject=Business%20Plan%20Inquiry'
  };

  const handleSubscribe = (tier: 'starter' | 'pro' | 'business') => {
    if (tier === 'starter') {
      onClose();
    } else if (tier === 'business') {
      window.location.href = LINKS.business;
    } else {
      // Open Stripe Checkout in new tab
      window.open(LINKS[tier], '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-trackit-panel border border-trackit-border rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl shadow-black/50">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-trackit-muted hover:text-trackit-text transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-trackit-text mb-4">
            Invest in your <span className="text-transparent bg-clip-text bg-gradient-to-r from-trackit-accent to-purple-500">Execution Intelligence</span>
          </h2>
          <p className="text-trackit-muted max-w-2xl mx-auto mb-12">
            Choose the tier that matches your ambition. Cancel anytime.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            
            {/* Starter Tier */}
            <div className="border border-trackit-border bg-trackit-dark/30 rounded-xl p-6 flex flex-col hover:border-trackit-muted transition-colors">
              <div className="mb-4">
                <span className="text-sm font-bold text-trackit-muted uppercase tracking-wider">Starter</span>
                <div className="mt-2 text-3xl font-bold text-trackit-text">Free</div>
                <p className="text-sm text-trackit-muted mt-1">Forever free for hobbyists.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-success">✓</span> 3 Sessions / Month
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-success">✓</span> Standard AI Model
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-success">✓</span> Basic Frameworks
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-success">✓</span> Local Browser Storage
                </li>
              </ul>
              <button 
                onClick={() => handleSubscribe('starter')}
                className="w-full py-3 rounded-lg border border-trackit-border text-trackit-muted font-bold text-sm hover:bg-trackit-border hover:text-trackit-text transition-all"
              >
                Current Plan
              </button>
            </div>

            {/* Pro Tier (Highlighted) */}
            <div className="border-2 border-trackit-accent bg-trackit-dark/80 rounded-xl p-6 flex flex-col relative transform md:-translate-y-4 shadow-xl shadow-trackit-accent/20">
              <div className="absolute top-0 right-0 bg-trackit-accent text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wider">
                Most Popular
              </div>
              <div className="mb-4">
                <span className="text-sm font-bold text-trackit-accent uppercase tracking-wider">Pro Executor</span>
                <div className="mt-2 text-3xl font-bold text-trackit-text">$12<span className="text-lg text-trackit-muted font-normal">/mo</span></div>
                <p className="text-sm text-trackit-muted mt-1">For serious achievers.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-accent">✓</span> <strong>Unlimited Sessions</strong>
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-accent">✓</span> <strong>Long-Term Memory</strong> (AI remembers past goals)
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-accent">✓</span> Advanced "Tough Love" Mode
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-accent">✓</span> Cloud Sync (All Devices)
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-trackit-accent">✓</span> Email Action Plans
                </li>
              </ul>
              <button 
                onClick={() => handleSubscribe('pro')}
                className="w-full py-3 rounded-lg bg-trackit-accent text-white font-bold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25"
              >
                Start 7-Day Trial
              </button>
            </div>

            {/* Business Tier */}
            <div className="border border-trackit-border bg-trackit-dark/30 rounded-xl p-6 flex flex-col hover:border-trackit-muted transition-colors">
              <div className="mb-4">
                <span className="text-sm font-bold text-purple-400 uppercase tracking-wider">Founder / Coach</span>
                <div className="mt-2 text-3xl font-bold text-trackit-text">$49<span className="text-lg text-trackit-muted font-normal">/mo</span></div>
                <p className="text-sm text-trackit-muted mt-1">For teams & coaches.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-purple-400">✓</span> Everything in Pro
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-purple-400">✓</span> 5 Team Seats
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-purple-400">✓</span> Custom Frameworks
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-purple-400">✓</span> API Access
                </li>
                <li className="flex items-center text-sm text-trackit-text">
                  <span className="mr-2 text-purple-400">✓</span> Priority Support
                </li>
              </ul>
              <button 
                onClick={() => handleSubscribe('business')}
                className="w-full py-3 rounded-lg border border-purple-500/30 text-purple-400 font-bold text-sm hover:bg-purple-900/20 hover:border-purple-500 transition-all"
              >
                Contact Sales
              </button>
            </div>

          </div>
          
          <div className="mt-12 pt-8 border-t border-trackit-border text-center">
             <p className="text-xs text-trackit-muted">
               Secured by Stripe. 100% Money-back guarantee if you don't achieve your first goal in 30 days.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;