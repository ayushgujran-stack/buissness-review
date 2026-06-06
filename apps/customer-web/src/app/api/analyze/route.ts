import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  try {
    const { feedbacks } = await req.json();
    
    if (!feedbacks || !Array.isArray(feedbacks)) {
      return NextResponse.json(
        { error: "Feedbacks array is required" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "dummy_gemini_key_replace_me") {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const feedbackContext = feedbacks
      .map(
        (f: any) => `
      Rating: ${f.ratings?.overallAverage?.toFixed(1) || "N/A"}
      Comment: ${f.feedbackText?.generalComments || "None"}
    `
      )
      .join("\n");

    const prompt = `You are a restaurant management AI assistant. Here is recent feedback from a restaurant branch:\n${feedbackContext}\n\nPlease provide a concise analysis of this data. Use bullet points. Highlight exactly what customers loved (Pros) and what needs improvement (Cons). Be direct and brief. Do not use markdown headers, just plain text with bullets.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json(
      { insight: text },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error: any) {
    console.error("AI Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI insights." },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
