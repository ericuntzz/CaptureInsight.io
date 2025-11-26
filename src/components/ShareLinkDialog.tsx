import React, { useState } from 'react';
import { X, Link2, Check, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShareLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

interface UrlField {
  id: string;
  value: string;
  error: string;
}

export function ShareLinkDialog({ isOpen, onClose, onSubmit }: ShareLinkDialogProps) {
  const [urlFields, setUrlFields] = useState<UrlField[]>([{ id: '1', value: '', error: '' }]);

  const addUrlField = () => {
    setUrlFields([...urlFields, { id: Date.now().toString(), value: '', error: '' }]);
  };

  const removeUrlField = (id: string) => {
    if (urlFields.length > 1) {
      setUrlFields(urlFields.filter(field => field.id !== id));
    }
  };

  const updateUrlField = (id: string, value: string) => {
    setUrlFields(urlFields.map(field => 
      field.id === id ? { ...field, value, error: '' } : field
    ));
  };

  const handleSubmit = () => {
    // Validate all fields
    let hasError = false;
    const updatedFields = urlFields.map(field => {
      if (!field.value.trim()) {
        hasError = true;
        return { ...field, error: 'Please enter a valid URL' };
      }

      try {
        new URL(field.value);
        return { ...field, error: '' };
      } catch (e) {
        hasError = true;
        return { ...field, error: 'Please enter a valid URL' };
      }
    });

    setUrlFields(updatedFields);

    if (!hasError) {
      // Submit each URL
      urlFields.forEach(field => {
        if (field.value.trim()) {
          onSubmit(field.value);
        }
      });
      setUrlFields([{ id: '1', value: '', error: '' }]);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] w-full max-w-md mx-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,107,53,0.2)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white">Insert Share Link</h3>
                  <p className="text-xs text-[#9CA3AF]">Add a link to a viewable online document</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[rgba(255,107,53,0.1)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[#9CA3AF] hover:text-[#FF6B35]" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-[#9CA3AF]">
                    Document URL{urlFields.length > 1 ? 's' : ''}
                  </label>
                  <button
                    onClick={addUrlField}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(255,107,53,0.1)] hover:bg-[rgba(255,107,53,0.2)] border border-[rgba(255,107,53,0.3)] rounded-lg text-[#FF6B35] text-xs transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Link
                  </button>
                </div>
                
                {urlFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => updateUrlField(field.id, e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://docs.google.com/spreadsheets/..."
                        className={`w-full bg-[#0A0E1A] border rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-[#FF6B35] transition-colors ${
                          field.error ? 'border-red-500' : 'border-[rgba(255,107,53,0.3)]'
                        }`}
                        autoFocus={index === 0}
                      />
                      {field.error && (
                        <p className="mt-1.5 text-xs text-red-400">{field.error}</p>
                      )}
                    </div>
                    {urlFields.length > 1 && (
                      <button
                        onClick={() => removeUrlField(field.id)}
                        className="mt-2.5 p-2 hover:bg-[rgba(255,107,53,0.1)] rounded-lg transition-colors group"
                        title="Remove this URL"
                      >
                        <Trash2 className="w-4 h-4 text-[#9CA3AF] group-hover:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] rounded-lg px-4 py-3">
                <p className="text-xs text-[#9CA3AF]">
                  <span className="text-[#FF6B35]">Tip:</span> Paste a share link to Google Sheets, Excel Online, Airtable, or any other viewable online document.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,107,53,0.2)]">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg text-sm hover:shadow-lg transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Add Link{urlFields.length > 1 ? 's' : ''}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
