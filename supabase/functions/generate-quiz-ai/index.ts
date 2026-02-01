import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Include both cases to satisfy strict CORS preflight clients
  'Access-Control-Allow-Headers': 'authorization, Authorization, x-client-info, apikey, content-type',
};

interface QuizParams {
  subject: string;
  topic: string;
  numQuestions: number;
  complexity: 'Easy' | 'Medium' | 'Hard';
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization Header:', authHeader ? 'present' : 'missing');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'No authorization header',
        success: false 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user is authenticated and is a teacher
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    console.log('Decoded JWT:', authData?.user ? { userId: authData.user.id, email: authData.user.email } : null, 'Error:', authError?.message || null);
    
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ 
        error: 'Authentication failed',
        success: false 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = authData.user;

    // Check if user is a teacher
    const { data: teacherData, error: teacherError } = await supabaseClient
      .from('teachers')
      .select('id')
      .eq('id', user.id)
      .single();
    console.log('Teacher Check:', teacherData ? 'found' : 'not found', 'Error:', teacherError?.message || null);

    if (teacherError || !teacherData) {
      return new Response(JSON.stringify({ 
        error: 'Access denied: Teachers only',
        success: false 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params: QuizParams = await req.json();
    console.log('Generating quiz with params:', params);

    // Generate AI prompt
    const prompt = `Create ${params.numQuestions} multiple choice questions about ${params.topic} in ${params.subject}. 
    Difficulty level: ${params.complexity}
    
    Requirements:
    - Each question should have exactly 4 options (A, B, C, D)
    - Questions should be clear and educational
    - Options should be plausible but only one correct
    - Cover different aspects of the topic
    - Appropriate for ${params.complexity.toLowerCase()} level students
    
    Format your response as a JSON array with this exact structure:
    [
      {
        "text": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctOption": 0
      }
    ]
    
    Where correctOption is the index (0-3) of the correct answer.
    
    Return only the JSON array, no additional text or formatting.`;

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    console.log('Calling Gemini API...');
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    let generatedText = geminiData.candidates[0].content.parts[0].text;
    console.log('Generated text:', generatedText.substring(0, 200) + '...');

    // Clean up the response - remove markdown formatting if present
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse the generated questions
    let questions: GeneratedQuestion[];
    try {
      questions = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      throw new Error('Failed to parse AI-generated questions');
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('AI did not generate valid questions');
    }

    // Validate questions structure
    questions = questions.map((q, index) => {
      if (!q.text || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctOption !== 'number') {
        throw new Error(`Invalid question structure at index ${index}`);
      }
      
      if (q.correctOption < 0 || q.correctOption > 3) {
        throw new Error(`Invalid correct option at question ${index + 1}`);
      }

      return {
        text: q.text,
        options: q.options,
        correctOption: q.correctOption
      };
    });

    // Generate room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create quiz in database
    const quizTitle = params.title || `AI Generated: ${params.subject} - ${params.topic}`;
    const quizDescription = params.description || `AI-generated quiz on ${params.topic} (${params.complexity} level)`;

    console.log('Creating quiz in database...');
    const { data: quizData, error: quizError } = await supabaseClient
      .from('quizzes')
      .insert({
        title: quizTitle,
        description: quizDescription,
        time_per_question: params.timePerQuestion,
        room_code: roomCode,
        created_by: user.id,
        quiz_type: 'classnode'
      })
      .select()
      .single();

    if (quizError || !quizData) {
      console.error('Quiz creation error:', quizError);
      throw new Error('Failed to create quiz');
    }

    // Insert questions
    console.log('Inserting questions...');
    const questionsToInsert = questions.map((q, index) => ({
      quiz_id: quizData.id,
      text: q.text,
      options: q.options,
      correct_option: q.correctOption,
      order_num: index + 1
    }));

    const { error: questionsError } = await supabaseClient
      .from('quiz_questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Questions insertion error:', questionsError);
      // Clean up the quiz if questions failed
      await supabaseClient.from('quizzes').delete().eq('id', quizData.id);
      throw new Error('Failed to create quiz questions');
    }

    console.log('Quiz created successfully with ID:', quizData.id);

    return new Response(JSON.stringify({
      success: true,
      quiz: {
        id: quizData.id,
        title: quizData.title,
        description: quizData.description,
        roomCode: quizData.room_code,
        questionsCount: questions.length
      },
      questions: questions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-quiz-ai function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
