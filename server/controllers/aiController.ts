import { Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

function generateLocalMeetingSummary(title: string, chatHistory: any[], polls: any[], notes: string): string {
  const cleanTitle = title || "Collab Session";
  const notesSnippet = notes && notes.trim() ? notes.trim() : "No specific agenda notes added.";
  
  // Parse chats
  const chatCount = chatHistory ? chatHistory.length : 0;
  let chatDetail = "";
  const actionItems: string[] = [];
  
  if (chatCount > 0) {
    const participantsList = Array.from(new Set(chatHistory.map((m: any) => m.senderName)));
    chatDetail = `The discussion involved key inputs from ${participantsList.join(", ")} with a total of ${chatCount} messages exchanged. `;
    
    // Attempt to extract action items from chats
    chatHistory.forEach((m: any) => {
      const msg = m.message.toLowerCase();
      if (msg.includes("will ") || msg.includes("need to") || msg.includes("action") || msg.includes("todo") || msg.includes("task") || msg.includes("schedule")) {
        actionItems.push(`${m.senderName}: "${m.message}"`);
      }
    });
  } else {
    chatDetail = "No chat messages were exchanged during this meeting.";
  }
  
  // Parse polls
  const pollCount = polls ? polls.length : 0;
  let pollDetail = "";
  if (pollCount > 0) {
    pollDetail = "The following interactive polls were conducted:\n";
    polls.forEach((p: any, idx: number) => {
      const optionsStr = p.options.map((o: any) => `${o.optionText} (${(o.votes || []).length} votes)`).join(", ");
      pollDetail += `* **${p.question}** - Results: ${optionsStr}\n`;
    });
  } else {
    pollDetail = "No interactive polls were launched during this session.";
  }

  if (actionItems.length === 0) {
    actionItems.push("Review meeting discussion and follow up on outstanding questions.");
    actionItems.push("Synthesize whiteboard design layout updates into the next sprint plan.");
  }

  return `# Meeting Summary: ${cleanTitle}

## 📌 Executive Summary
A collaborative synchronisation session was conducted. The team aligned on project progress, reviewed discussion points, and logged interactive poll results.

## 💬 Discussion & Chat Review
${chatDetail}

## 📝 Meeting Notes & Agenda
* **Canvas Notes / Agenda**: ${notesSnippet}

## 📊 Interactive Poll Results
${pollDetail}

## 🎯 Action Items & Next Steps
${actionItems.map((item) => `* 📝 ${item}`).join("\n")}`;
}

export async function summarizeMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, chatHistory, polls, notes } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    const isMock = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "dummy-api-key" || apiKey === "";

    if (isMock) {
      console.warn("⚠️ [AI ASSISTANT PREVIEW MODE] GEMINI_API_KEY is missing. Providing dynamic simulated summary.");
      const dynamicSummary = generateLocalMeetingSummary(title, chatHistory, polls, notes);

      setTimeout(() => {
        res.json({
          success: true,
          previewMode: true,
          summary: dynamicSummary,
          sentiment: "Collaborative Sync",
          topics: ["Session Review"],
        });
      }, 800);
      return;
    }

    // Real API integration
    const ai = new GoogleGenAI({ apiKey });
    const chatSnippet = chatHistory && chatHistory.length > 0 
      ? chatHistory.map((m: any) => `${m.senderName}: ${m.message}`).join("\n")
      : "No chat history recorded.";

    const pollsSnippet = polls && polls.length > 0
      ? polls.map((p: any) => `Question: ${p.question}. Votes: ${JSON.stringify(p.options)}`).join("\n")
      : "No polls created.";

    const prompt = `You are an expert AI meeting assistant. Please analyze the following meeting metadata and generate a comprehensive, highly professional summary of the meeting, including key discussion points, sentiment analysis, action items, and topic list.

Meeting Title: ${title || "General Conference Room"}
Canvas Notes: ${notes || "None"}
Poll Log:
${pollsSnippet}

Chat Session History:
${chatSnippet}

Please structure the summary neatly in Markdown format with clear bullet points. Ensure the tone is corporate, objective, and constructive. Highlight action items with responsible parties if detectable.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      previewMode: false,
      summary: response.text || "No response generated from the model.",
      sentiment: "Collaborative & Engaged",
      topics: ["Meeting General Notes"],
    });

  } catch (error: any) {
    console.error("⚠️ Gemini AI Summarization failed, falling back to local generator:", error?.message || error);
    
    const { title, chatHistory, polls, notes } = req.body;
    const fallbackSummary = generateLocalMeetingSummary(title, chatHistory, polls, notes);

    res.json({
      success: true,
      previewMode: true,
      summary: fallbackSummary,
      sentiment: "Simulated Review",
      topics: ["Meeting Sync Recovers"],
    });
  }
}

export async function generateCaptions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { phrase } = req.body;
  try {
    res.json({
      success: true,
      caption: `[Live Caption] Heard: "${phrase || "Greetings! Let's get this meeting started."}"`,
    });
  } catch (error: any) {
    res.json({
      success: true,
      caption: `[Captions Sync Offline] ${phrase}`,
    });
  }
}
