import { createServer } from "./api/server.js";
import { geminiClient } from "./clients/gemini.client.js";
import { env } from "./config/env.js";
import {
  GeminiConversationModel,
  SafetyBoundConversationModel,
} from "./conversation/geminiConversation.model.js";

const PORT = Number(process.env.AI_ENGINE_PORT ?? 3001);

const conversationModel = new SafetyBoundConversationModel(new GeminiConversationModel(
  async ({ prompt }) => {
    const response = await geminiClient.models.generateContent({
      model: env.geminiModel,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    return response.text?.trim() ?? "";
  },
));

const app = createServer(conversationModel);

app.listen(PORT, () => {
  console.log(
    `[AI Engine] HTTP server started on port ${PORT}`,
  );

  console.log(
    `[AI Engine] Health: http://localhost:${PORT}/health`,
  );

  console.log(
    `[AI Engine] Action endpoint: http://localhost:${PORT}/api/ai/action`,
  );
});
