
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Quiz } from "@/types/quiz";
import { useQuiz } from "@/contexts/quiz";
import { Play, Clock, FileQuestion, Trash2, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import QuizPreviewModal from "./QuizPreviewModal";

interface QuizListProps {
  quizzes: Quiz[];
  onLaunch: (id: string) => void;
  isLaunchDisabled: boolean;
}

const QuizList: React.FC<QuizListProps> = ({ quizzes, onLaunch, isLaunchDisabled }) => {
  const { deleteQuiz } = useQuiz();
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePreview = (quiz: Quiz) => {
    setPreviewQuiz(quiz);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewQuiz(null);
  };

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block p-4 rounded-full bg-muted mb-4">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No quizzes found</h3>
        <p className="text-muted-foreground">
          Create your first quiz to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {quizzes.map((quiz) => (
        <Card key={quiz.id} className="border-2 border-quiz-primary/10 hover:border-quiz-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardTitle>{quiz.title}</CardTitle>
            <CardDescription>
              {quiz.questions.length} questions
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              <span>{quiz.timePerQuestion} seconds per question</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the quiz "{quiz.title}" and all of its questions.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteQuiz(quiz.id)}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePreview(quiz)}
                className="text-primary hover:text-primary"
              >
                <Eye className="h-4 w-4 mr-1" />
                Review
              </Button>
            </div>
            <Button 
              onClick={() => onLaunch(quiz.id)} 
              disabled={isLaunchDisabled}
              className="quiz-gradient"
            >
              <Play className="h-4 w-4 mr-1" />
              Launch
            </Button>
          </CardFooter>
        </Card>
      ))}
      <QuizPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        quiz={previewQuiz}
      />
    </div>
  );
};

export default QuizList;
