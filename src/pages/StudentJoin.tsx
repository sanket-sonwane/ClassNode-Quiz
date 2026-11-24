import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const StudentJoin = () => {
  const { login, setRoomCode } = useAuth();
  const [name, setName] = useState("");
  const [roomCode, setRoomCodeState] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const { roomCode: urlRoomCode } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (urlRoomCode) {
      setRoomCodeState(urlRoomCode);
    }
  }, [urlRoomCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!roomCode.trim()) {
      toast.error("Please enter a room code");
      return;
    }

    setIsValidating(true);

    try {
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("id, is_active, room_code, title")
        .eq("room_code", roomCode.toUpperCase())
        .single();

      if (quizError || !quizData) {
        toast.error("Invalid room code. Please check and try again.");
        setIsValidating(false);
        return;
      }

      if (!quizData.is_active) {
        toast.error("This quiz is not currently active.");
        setIsValidating(false);
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .insert([{ name: name.trim() }])
        .select()
        .single();

      if (studentError) {
        console.error("Error creating student:", studentError);
        toast.error("Failed to join quiz. Please try again.");
        setIsValidating(false);
        return;
      }

      localStorage.setItem("quizRoomCode", roomCode.toUpperCase());
      localStorage.setItem("studentId", studentData.id);

      setRoomCode(roomCode.toUpperCase());
      // Keep the real student UUID so answers/results reference the right row.
      login(name.trim(), "student", studentData.id);

      console.log("Student joined successfully:", {
        studentId: studentData.id,
        roomCode: roomCode.toUpperCase(),
        quizTitle: quizData.title
      });

      navigate("/student");
    } catch (error) {
      console.error("Error joining quiz:", error);
      toast.error("Failed to join quiz. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen quiz-pattern flex items-center justify-center px-4 py-6">
      <div className="w-full sm:max-w-md">
        <Card className="border-2 border-quiz-primary/20 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
              <span className="text-quiz-primary">Class</span>
              <span className="text-quiz-secondary">Node</span>
            </CardTitle>
            <CardDescription className="text-center text-sm sm:text-base">
              Join a quiz session as a student
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCodeState(e.target.value.toUpperCase())}
                  className="uppercase"
                  maxLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full quiz-gradient"
                disabled={isValidating}
              >
                {isValidating ? "Joining..." : "Join Quiz"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center gap-2 text-sm text-gray-500 text-center">
            <p className="text-xs sm:text-sm">
              Enter the room code provided by your teacher
            </p>
            <a
              href="/"
              className="text-quiz-primary hover:underline"
            >
              Teacher? Login here
            </a>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default StudentJoin;
