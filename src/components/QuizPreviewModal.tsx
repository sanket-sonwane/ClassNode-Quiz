import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Quiz } from "@/types/quiz";
import { Clock, FileQuestion, CheckCircle } from "lucide-react";

interface QuizPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz | null;
}

const QuizPreviewModal: React.FC<QuizPreviewModalProps> = ({
  isOpen,
  onClose,
  quiz,
}) => {
  if (!quiz) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5" />
            {quiz.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4 text-sm">
            <span>{quiz.questions.length} questions</span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {quiz.timePerQuestion}s per question
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {quiz.description && (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              {quiz.description}
            </div>
          )}

          <div className="space-y-4">
            {quiz.questions.map((question, index) => (
              <Card key={question.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">
                      Q{index + 1}
                    </Badge>
                    <span className="leading-relaxed">{question.text}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className={`p-3 rounded-lg border transition-colors ${
                          optionIndex === question.correctOption
                            ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
                            : "bg-muted/30 border-muted-foreground/20"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={optionIndex === question.correctOption ? "default" : "secondary"}
                            className="shrink-0 min-w-[24px] h-6 flex items-center justify-center text-xs"
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </Badge>
                          <span className="flex-1">{option}</span>
                          {optionIndex === question.correctOption && (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuizPreviewModal;