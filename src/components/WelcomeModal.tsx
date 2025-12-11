import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Download, Send, Loader2, HelpCircle, Chrome } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface TutorialVideo {
  id: string;
  title: string;
  duration: string;
  vimeoId?: string;
}

const tutorialVideos: TutorialVideo[] = [
  { id: '1', title: 'Install Chrome Extension', duration: '00:00:24' },
  { id: '2', title: 'Capture Your First Data', duration: '00:00:52' },
  { id: '3', title: 'Analyze Your Insights', duration: '00:00:23' },
];

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  const [selectedVideo, setSelectedVideo] = useState(tutorialVideos[0]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionName, setQuestionName] = useState('');
  const [questionEmail, setQuestionEmail] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitQuestion = async () => {
    if (!questionText.trim()) {
      toast.error('Please enter your question');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: questionName.trim() || 'Anonymous',
          email: questionEmail.trim(),
          question: questionText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send question');
      }

      toast.success('Your question has been sent! We\'ll get back to you soon.');
      setShowQuestionForm(false);
      setQuestionName('');
      setQuestionEmail('');
      setQuestionText('');
    } catch (error) {
      toast.error('Failed to send question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadExtension = () => {
    toast.info('Chrome extension coming soon! We\'ll notify you when it\'s available.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 bg-white rounded-2xl overflow-hidden border-0 shadow-2xl">
        <DialogTitle className="sr-only">Welcome to CaptureInsight</DialogTitle>
        
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 rounded-full p-2 hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        <div className="p-8 pb-0 text-center">
          <h1 className="text-3xl font-bold text-[#030213]">Welcome to CaptureInsight!</h1>
          <p className="mt-2 text-gray-600 text-lg">
            Watch this quick tutorial to capture & analyze your first data.
          </p>
        </div>

        <div className="flex p-8 gap-6">
          <div className="flex-1">
            <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
              {selectedVideo.vimeoId ? (
                <iframe
                  src={`https://player.vimeo.com/video/${selectedVideo.vimeoId}?badge=0&autopause=0&player_id=0&app_id=58479`}
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                  title={selectedVideo.title}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                  <div className="mb-8 flex items-center gap-3 text-sm text-gray-500">
                    <div className="w-6 h-6 bg-gradient-to-br from-[#FF6B35] to-[#FF8F5F] rounded-full flex items-center justify-center">
                      <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                    </div>
                    <span className="font-medium">Tutorial Video</span>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#FF6B35]/20 rounded-full blur-xl animate-pulse" />
                    <button className="relative w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform border border-gray-100">
                      <Play className="w-8 h-8 text-[#030213] fill-[#030213] ml-1" />
                    </button>
                  </div>
                  
                  <div className="mt-8 text-center px-8">
                    <p className="font-semibold text-gray-800">{selectedVideo.title}</p>
                    <p className="text-sm text-gray-500 mt-1">Video coming soon</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-[#FF6B35] to-[#FF8F5F] rounded-lg flex items-center justify-center">
                  <Chrome className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">Download Chrome Extension</p>
                  <p className="text-xs text-gray-500">Capture your screen or specific tabs</p>
                </div>
              </div>
              <Button
                onClick={handleDownloadExtension}
                className="bg-[#030213] hover:bg-[#1a1a2e] text-white rounded-lg px-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Chrome Extension
              </Button>
            </div>
          </div>

          <div className="w-72 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowQuestionForm(true)}
                className="flex-1 bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32] hover:bg-[#c8e6c9] font-semibold rounded-lg"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Questions?
              </Button>
              <Button variant="outline" className="p-2 rounded-lg border-gray-200">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#FF6B35" stroke="#FF6B35" strokeWidth="2"/>
                </svg>
              </Button>
              <div className="p-2 rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF8F5F] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">CI</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">CaptureInsight</span>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-gray-50 rounded-xl p-3 space-y-2">
              {tutorialVideos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                    selectedVideo.id === video.id
                      ? 'bg-[#030213] text-white'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedVideo.id === video.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    <Play className={`w-3 h-3 ${
                      selectedVideo.id === video.id ? 'text-white fill-white' : 'text-gray-600 fill-gray-600'
                    } ml-0.5`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${
                      selectedVideo.id === video.id ? 'text-white' : 'text-gray-800'
                    }`}>
                      {video.title}
                    </p>
                  </div>
                  <span className={`text-xs ${
                    selectedVideo.id === video.id ? 'text-white/70' : 'text-gray-400'
                  }`}>
                    {video.duration}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 pb-6 text-center">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-semibold text-[#030213]">CaptureInsight</span>
          </p>
        </div>

        <AnimatePresence>
          {showQuestionForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowQuestionForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-[#030213]">Ask a Question</h3>
                  <button
                    onClick={() => setShowQuestionForm(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <p className="text-gray-600 text-sm mb-4">
                  Have a question about CaptureInsight? We'll get back to you as soon as possible.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name (optional)
                    </label>
                    <Input
                      value={questionName}
                      onChange={(e) => setQuestionName(e.target.value)}
                      placeholder="John Doe"
                      className="rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Email (optional)
                    </label>
                    <Input
                      type="email"
                      value={questionEmail}
                      onChange={(e) => setQuestionEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Question <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="What would you like to know about CaptureInsight?"
                      className="rounded-lg min-h-[120px]"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitQuestion}
                    disabled={isSubmitting || !questionText.trim()}
                    className="w-full bg-[#FF6B35] hover:bg-[#e55a28] text-white rounded-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Question
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

const WELCOME_SHOWN_KEY = 'captureinsight_welcome_shown';

export function useWelcomeModal() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY);
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, []);

  const closeWelcome = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
    setShowWelcome(false);
  };

  const openWelcome = () => {
    setShowWelcome(true);
  };

  return {
    showWelcome,
    closeWelcome,
    openWelcome,
  };
}
