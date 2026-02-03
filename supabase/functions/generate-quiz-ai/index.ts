import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
};

interface QuizParams {
  subject: string;
  topic: string;
  numQuestions: number;
  complexity: "Easy" | "Medium" | "Hard";
  timePerQuestion: number;
  title?: string;
  description?: string;
}

interface GeneratedQuestion {
  text: string;
  options: string[];
  correctOption: number;
}

serve(async (req) => {
  console.log("=== Edge function started ===");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---------- SUPABASE CLIENT ----------
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ---------- AUTH CHECK ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    // ---------- TEACHER CHECK (you said this table exists) ----------
    const { data: teacherData, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("id", user.id)
      .single();

    if (teacherError || !teacherData) {
      throw new Error("Access denied: Teachers only");
    }

    // ---------- READ BODY ----------
    const params: QuizParams = await req.json();
    console.log("Params:", params);

    // ---------- BUILD PROMPT FOR GPT-4.1-MINI ----------
    const prompt = `
Create ${params.numQuestions} multiple choice questions about ${params.topic} 
in ${params.subject}. Difficulty: ${params.complexity}.

Return ONLY a JSON array in this exact format (no markdown):

[
  {
    "text": "Question?",
    "options": ["A", "B", "C", "D"],
    "correctOption": 0
  }
]
`;

    // ---------- CALL OPENAI ----------
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured in Supabase secrets");
    }

    console.log("Calling OpenAI GPT-4.1-mini...");

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You are a quiz generator. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.6,
      }),
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text();
      console.error("OpenAI error:", txt);
      throw new Error(`OpenAI API error: ${openaiRes.status}`);
    }

    const aiData = await openaiRes.json();
    let generatedText = aiData.choices[0].message.content.trim();

    console.log("Raw AI output:", generatedText.substring(0, 200));

    // ---------- PARSE QUESTIONS ----------
    let questions: GeneratedQuestion[];

    try {
      questions = JSON.parse(generatedText);
    } catch (err) {
      console.error("Parse error:", generatedText);
      throw new Error("AI returned invalid JSON");
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("AI did not generate valid questions");
    }

    // ---------- CREATE QUIZ (your schema) ----------
    const roomCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    const quizTitle =
      params.title ||
      `AI Generated: ${params.subject} - ${params.topic}`;

    const quizDescription =
      params.description ||
      `AI-generated quiz on ${params.topic} (${params.complexity} level)`;

    console.log("Inserting quiz...");

    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        title: quizTitle,
        description: quizDescription,
        time_per_question: params.timePerQuestion,
        room_code: roomCode,
        created_by: user.id,
        quiz_type: "classnode",
      })
      .select()
      .single();

    if (quizError || !quizData) {
      console.error("Quiz creation error:", quizError);
      throw new Error("Failed to create quiz");
    }

    console.log("Quiz created:", quizData.id);

    // ---------- INSERT QUESTIONS ----------
    const questionsToInsert = questions.map((q, i) => ({
      quiz_id: quizData.id,
      text: q.text,
      options: q.options,
      correct_option: q.correctOption,
      order_num: i + 1,
    }));

    const { error: qErr } = await supabase
      .from("quiz_questions")
      .insert(questionsToInsert);

    if (qErr) {
      console.error("Questions insert error:", qErr);
      await supabase.from("quizzes").delete().eq("id", quizData.id);
      throw new Error("Failed to save questions");
    }

    console.log("Quiz fully created");

    return new Response(
      JSON.stringify({
        success: true,
        quiz: {
          id: quizData.id,
          title: quizData.title,
          description: quizData.description,
          roomCode: quizData.room_code,
          questionsCount: questions.length,
        },
        questions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("ERROR:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
