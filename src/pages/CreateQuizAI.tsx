import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, ArrowLeft, Brain, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface QuizParams {
  subject: string;
  topic: string;
  numQuestions: number;
  complexity: 'Easy' | 'Medium' | 'Hard';
  timePerQuestion: number;
  title?: string;
  description?: string;
}

const CreateQuizAI = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<QuizParams>({
    subject: '',
    topic: '',
    numQuestions: 5,
    complexity: 'Medium',
    timePerQuestion: 30,
  });

  // Redirect if not teacher
  React.useEffect(() => {
    if (user && user.role !== 'teacher') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleInputChange = (field: keyof QuizParams, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!formData.subject.trim() || !formData.topic.trim()) {
    toast.error('Please fill in all required fields');
    return;
  }

  if (formData.numQuestions < 1 || formData.numQuestions > 20) {
    toast.error('Number of questions must be between 1 and 20');
    return;
  }

  setLoading(true);

  try {
    // Refresh the session to ensure we have a valid, non-expired token
    const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
    
    if (sessionError || !session?.access_token) {
      // If refresh fails, try to get the current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Please log in again to continue');
      }
    }

    // Invoke the Edge Function
    const response = await supabase.functions.invoke('generate-quiz-ai', {
      body: formData,
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to generate quiz');
    }

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Quiz generation failed');
    }

    const { quiz } = response.data;
    toast.success(`Quiz "${quiz.title}" created successfully with ${quiz.questionsCount} questions!`);
    navigate('/teacher');

  } catch (error) {
    console.error('Quiz generation error:', error);
    
    // Handle 401 specifically
    if (error instanceof Error && error.message.includes('401')) {
      toast.error('Session expired. Please log in again.');
      // Optionally redirect to login
      // navigate('/login');
    } else {
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz');
    }
  } finally {
    setLoading(false);
  }
};

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex items-center text-white">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Checking permissions...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex items-center text-white">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Checking permissions...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

          {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/teacher')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Main content */}
        <div className="max-w-4xl mx-auto">
          {/* Hero section */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white">Create Quiz with AI</h1>
              <Sparkles className="h-8 w-8 text-yellow-400 animate-pulse" />
            </div>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Let artificial intelligence generate high-quality, customized quizzes for your students. 
              Just provide the parameters, and we'll create engaging questions instantly.
            </p>
          </div>

          {/* Form card */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-2xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl text-white flex items-center justify-center gap-2">
                <Zap className="h-6 w-6 text-yellow-400" />
                Quiz Configuration
              </CardTitle>
              <CardDescription className="text-gray-300">
                Configure your AI-generated quiz parameters below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Row 1: Subject and Topic */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-white font-medium">
                      Subject Name *
                    </Label>
                    <Input
                      id="subject"
                      placeholder="e.g., Mathematics, History, Science"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20"
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="topic" className="text-white font-medium">
                      Topic Name *
                    </Label>
                    <Input
                      id="topic"
                      placeholder="e.g., Algebra, World War II, Photosynthesis"
                      value={formData.topic}
                      onChange={(e) => handleInputChange('topic', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Questions and Complexity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="numQuestions" className="text-white font-medium">
                      Number of Questions
                    </Label>
                    <Input
                      id="numQuestions"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.numQuestions}
                      onChange={(e) => handleInputChange('numQuestions', parseInt(e.target.value) || 5)}
                      className="bg-white/10 border-white/20 text-white focus:bg-white/20"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white font-medium">
                      Complexity Level
                    </Label>
                    <Select
                      value={formData.complexity}
                      onValueChange={(value: 'Easy' | 'Medium' | 'Hard') => handleInputChange('complexity', value)}
                      disabled={loading}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white focus:bg-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="Easy" className="text-white hover:bg-slate-700">
                          Easy - Basic concepts
                        </SelectItem>
                        <SelectItem value="Medium" className="text-white hover:bg-slate-700">
                          Medium - Intermediate level
                        </SelectItem>
                        <SelectItem value="Hard" className="text-white hover:bg-slate-700">
                          Hard - Advanced concepts
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: Time per question */}
                <div className="space-y-2">
                  <Label htmlFor="timePerQuestion" className="text-white font-medium">
                    Time per Question (seconds)
                  </Label>
                  <Input
                    id="timePerQuestion"
                    type="number"
                    min="10"
                    max="300"
                    value={formData.timePerQuestion}
                    onChange={(e) => handleInputChange('timePerQuestion', parseInt(e.target.value) || 30)}
                    className="bg-white/10 border-white/20 text-white focus:bg-white/20"
                    disabled={loading}
                  />
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-white font-medium">
                      Custom Title (Optional)
                    </Label>
                    <Input
                      id="title"
                      placeholder="Leave empty for auto-generated title"
                      value={formData.title || ''}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-white font-medium">
                      Custom Description (Optional)
                    </Label>
                    <Input
                      id="description"
                      placeholder="Leave empty for auto-generated description"
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-6">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 text-lg font-medium py-6"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Generating Quiz...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate Quiz with AI
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Button
  type="button"
  onClick={async () => {
    const { data, error } = await supabase.functions.invoke(
      "generate-quiz-ai-v2",
      { body: formData }
    );

    console.log("V2 response:", data, error);
  }}
>
  TEST NEW AI (V2)
</Button>


          {/* Footer info */}
          <div className="text-center mt-8 text-gray-400">
            <p className="text-sm">
              AI-powered by Google Gemini • Questions will be automatically created and saved to your quiz library
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateQuizAI;
