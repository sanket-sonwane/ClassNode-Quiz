import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuiz } from "@/contexts/quiz";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { PlusCircle, LogOut, Play, List, BarChart2 } from "lucide-react";
import CreateQuizModal from "@/components/CreateQuizModal";
import QuizList from "@/components/QuizList";
import ActiveQuiz from "@/components/ActiveQuiz";
import QuizResults from "@/components/QuizResults";
import DarkModeSwitch from "@/components/ui/dark-mode-switch";

const TeacherDashboard = () => {
  const { user, logout, roomCode } = useAuth();
  const {
    quizzes,
    activeQuiz,
    launchQuiz,
    endQuiz,
    studentAnswers,
    results
  } = useQuiz();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const teacherQuizzes = useMemo(() => {
    if (!user) return [];
    return quizzes.filter((quiz) => quiz.createdBy === user.id);
  }, [quizzes, user]);

  const teacherResults = useMemo(() => {
    if (!user) return [];
    const teacherQuizIds = teacherQuizzes.map((quiz) => quiz.id);
    return results.filter((result) => teacherQuizIds.includes(result.quizId));
  }, [results, teacherQuizzes]);

  React.useEffect(() => {
    if (!user || user.role !== "teacher") {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user || user.role !== "teacher") {
    return null;
  }

  const displayRoomCode = activeQuiz?.roomCode || roomCode;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="border-b bg-white dark:bg-gray-900 sticky top-0 z-50 transition-colors duration-300">

        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold">
              <span className="text-quiz-primary">Class</span>
              <span className="text-quiz-secondary">Node</span>
            </h1>
                    <span className="text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md transition-colors duration-300">Teacher</span>

          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <DarkModeSwitch />
            {displayRoomCode && (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Room Code:</span>
                <span className="font-mono font-bold text-sm bg-quiz-primary/10 dark:bg-quiz-primary/20 text-quiz-primary px-2 py-1 rounded-md transition-colors duration-300">
                  {displayRoomCode}
                </span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300"
>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-2">
            Welcome, {user.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeQuiz
              ? "You have an active quiz running."
              : "Create or launch a quiz to get started with your students."}
          </p>
        </div>

        <Tabs defaultValue={activeQuiz ? "active" : "quizzes"}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="quizzes" disabled={!!activeQuiz}>
                <List className="h-4 w-4 mr-1" />
                My Quizzes
              </TabsTrigger>
              <TabsTrigger value="active" disabled={!activeQuiz}>
                <Play className="h-4 w-4 mr-1" />
                Active Quiz
              </TabsTrigger>
              <TabsTrigger value="results">
                <BarChart2 className="h-4 w-4 mr-1" />
                Results
              </TabsTrigger>
            </TabsList>

            {!activeQuiz && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="quiz-gradient flex-1 sm:flex-none mobile-button"
                  size="lg"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Quiz
                </Button>
                <Button 
                  onClick={() => navigate('/create-quiz-ai')}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white flex-1 sm:flex-none mobile-button"
                  size="lg"
                >
                  <span className="text-lg mr-2">✨</span>
                  <span className="hidden sm:inline">AI Quiz</span>
                  <span className="sm:hidden">AI</span>
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="quizzes">
            <QuizList
              quizzes={teacherQuizzes}
              onLaunch={launchQuiz}
              isLaunchDisabled={!!activeQuiz}
            />
          </TabsContent>

          <TabsContent value="active">
            {activeQuiz && (
              <ActiveQuiz
                quiz={activeQuiz}
                studentAnswers={studentAnswers}
                onEndQuiz={endQuiz}
              />
            )}
          </TabsContent>

          <TabsContent value="results">
            <QuizResults results={teacherResults} quizzes={teacherQuizzes} />
          </TabsContent>
        </Tabs>
      </main>

      <CreateQuizModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};

export default TeacherDashboard;
