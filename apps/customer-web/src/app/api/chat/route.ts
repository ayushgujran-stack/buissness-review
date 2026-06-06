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
    const { feedbacks, messages, userMessage } = await req.json();

    if (!feedbacks || !Array.isArray(feedbacks) || !userMessage) {
      return NextResponse.json(
        { error: "Feedbacks array and userMessage are required." },
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
      Food: ${f.ratings?.food?.average || "N/A"}, Service: ${
          f.ratings?.service?.average || "N/A"
        }, Ambience: ${f.ratings?.ambience?.average || "N/A"}
      Comment: ${f.feedbackText?.generalComments || "None"}
    `
      )
      .join("\n");

    const systemPrompt = `You are a helpful assistant for a restaurant branch manager. Use ONLY the following customer feedback data to answer their questions. If they ask something unrelated to this data, politely tell them you can only answer questions based on customer feedback.\n\nFeedback Data:\n${feedbackContext}`;

    // Format history according to Gemini API requirements:
    // parts must be an array of objects e.g., [{ text: '...' }]
    const formattedHistory = [
      { role: "user", parts: [{ text: systemPrompt }] },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I will act as the restaurant assistant based on this feedback.",
          },
        ],
      },
    ];

    if (Array.isArray(messages)) {
      messages.forEach((m: any) => {
        formattedHistory.push({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        });
      });
    }

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json(
      { text: text },
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
    console.error("AI Chat error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate chat response." },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
