
import React from 'react';
import { Icons } from '../components/Icons';

export const Support: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
          <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
          <p className="text-gray-500 mt-2">Find answers to common questions or contact our dedicated legal support team.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                   <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                       <Icons.Help size={20} className="text-purple-600" />
                       Frequently Asked Questions
                   </h3>
                   <div className="space-y-4">
                       {[
                           { q: "How do I upload a PDF contract?", a: "Go to Documents or Contracts page, click 'Upload PDF', and select your file. The AI will automatically clean and categorize it." },
                           { q: "How does the Firm DNA training work?", a: "Navigate to Settings > Firm DNA. Upload 5-10 examples of your best past contracts. The AI analyzes your tone and structure to replicate it in future drafts." },
                           { q: "Can I invite external clients?", a: "Currently, LegalFlow is for internal firm use. You can export contracts as PDF/Word to send to clients manually." }
                       ].map((faq, i) => (
                           <div key={i} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                               <h4 className="text-sm font-semibold text-gray-800 mb-1">{faq.q}</h4>
                               <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                           </div>
                       ))}
                   </div>
               </div>

               <div className="bg-purple-50 rounded-xl border border-purple-100 p-6 flex items-start gap-4">
                   <div className="p-3 bg-white rounded-lg shadow-sm text-purple-600">
                       <Icons.Sparkles size={24} />
                   </div>
                   <div>
                       <h3 className="font-bold text-gray-900">LegalFlow AI Training</h3>
                       <p className="text-sm text-gray-600 mt-1 mb-3">
                           Need help fine-tuning the AI models for your specific jurisdiction? Our engineering team offers concierge onboarding.
                       </p>
                       <button className="text-sm font-bold text-purple-700 hover:text-purple-900 hover:underline">Book a consultation &rarr;</button>
                   </div>
               </div>
          </div>

          <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Contact Support</h3>
                  <form className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                              <option>Technical Issue</option>
                              <option>Billing Question</option>
                              <option>Feature Request</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
                          <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe your issue..." />
                      </div>
                      <button type="button" className="w-full bg-gray-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-gray-800">Send Message</button>
                  </form>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-gray-900 mb-2">System Status</h3>
                  <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700">All Systems Operational</span>
                  </div>
                  <p className="text-xs text-gray-500">Last updated: Just now</p>
              </div>
          </div>
      </div>
    </div>
  );
};
