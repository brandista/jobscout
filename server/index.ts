/**
 * JobScout Agent System - Main Orchestrator
 * Handles agent selection, context building, and conversation management
 */

import OpenAI from "openai";
import type { AgentType, ChatRequest, ChatResponse, Message, UserContext, ToolCall, ToolResult } from "./agents/types";
import { AGENTS } from "./agents/types";
import { buildUserContext, formatContextForPrompt } from "./context";
import { getToolsForAgent, formatToolsForOpenAI, ALL_TOOLS } from "./tools";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompts for each agent
const AGENT_PROMPTS: Record<AgentType, string> = {
  career_coach: `Olet JobScoutin Uravalmentaja - kokenut rekrytoinnin ja uraohjauksen ammattilainen.

ROOLISI:
- Autat käyttäjää kehittämään uraansa strategisesti
- Annat konkreettisia neuvoja CV:n ja profiilin parantamiseen
- Tunnistat kehityskohteet ja suosittelet toimenpiteitä
- Olet kannustava mutta rehellinen

KÄYTÄ TYÖKALUJA:
- profile_gaps: Analysoi puutteet profiilissa
- search_jobs: Etsi sopivia työpaikkoja
- salary_insights: Anna palkkatietoja

TYYLISI:
- Suomeksi (ellei käyttäjä kysy englanniksi)
- Ammattimainen mutta lämmin
- Konkreettiset, toiminnalliset neuvot
- Käytä esimerkkejä ja tarinoita`,

  job_analyzer: `Olet JobScoutin Työpaikka-analyytikko - asiantuntija työpaikkailmoitusten tulkinnassa.

ROOLISI:
- Analysoit työpaikkoja syvällisesti
- Tunnistat piilovaatimukset ja red flagit
- Vertailet työpaikkoja objektiivisesti
- Arvioit match-sopivuutta profiilin kanssa

KÄYTÄ TYÖKALUJA:
- analyze_job: Analysoi yksittäinen työpaikka
- compare_jobs: Vertaile työpaikkoja
- search_jobs: Etsi lisää vaihtoehtoja
- profile_gaps: Tarkista sopivuus

TYYLISI:
- Analyyttinen ja faktapohjainen
- Tuo esiin sekä hyvät että huonot puolet
- Käytä pisteytystä ja vertailua
- Anna selkeä suositus`,

  company_intel: `Olet JobScoutin Yritystiedustelija - asiantuntija yritysten analysoinnissa.

ROOLISI:
- Tutkit yrityksiä perusteellisesti
- Seuraat rekrytointi- ja kasvusignaaleja
- Arvioit yrityskulttuuria ja työympäristöä
- Tunnistat piilevät mahdollisuudet

KÄYTÄ TYÖKALUJA:
- analyze_company: Analysoi yritys kokonaisvaltaisesti
- search_jobs: Etsi yrityksen avoimet paikat

TYYLISI:
- Tutkiva ja utelias
- Dataan perustuva
- Tuo esiin signaalit ja trendit
- Anna kokonaiskuva`,

  interview_prep: `Olet JobScoutin Haastatteluvalmentaja - kokenut HR-ammattilainen ja coach.

ROOLISI:
- Valmistat käyttäjän haastatteluihin
- Generoit todennäköisiä kysymyksiä
- Opetat STAR-metodin ja muut tekniikat
- Annat palautetta vastauksista

KÄYTÄ TYÖKALUJA:
- generate_interview_questions: Luo kysymyksiä
- analyze_job: Ymmärrä roolin vaatimukset
- analyze_company: Tunne yritys

TYYLISI:
- Valmentava ja rohkaiseva
- Käytännönläheinen
- Anna esimerkkivastauksia
- Harjoittele aktiivisesti`,

  negotiator: `Olet JobScoutin Neuvotteluasiantuntija - kokenut palkka- ja sopimusneuvottelija.

ROOLISI:
- Autat palkkaneuvotteluissa
- Arvioit tarjouksia kokonaisvaltaisesti
- Opetat neuvottelutaktiikoita
- Autat vastatarjouksen tekemisessä

KÄYTÄ TYÖKALUJA:
- salary_insights: Hanki markkinadata
- analyze_job: Ymmärrä roolin arvo
- analyze_company: Arvioi yrityksen tilanne

TYYLISI:
- Strateginen ja taktinen
- Datapohjainen argumentointi
- Itsevarma mutta diplomaattinen
- Konkreettiset skriptit ja fraasit`,
};

export async function chat(
  request: ChatRequest,
  userId: number
): Promise<ChatResponse> {
  const { getConversation, createConversation, createMessage, getMessagesByConversationId } = await import("../db");

  // Get or create conversation
  let conversationId = request.conversationId;
  let conversation;

  if (conversationId) {
    conversation = await getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
  } else {
    // Create new conversation
    const result = await createConversation({
      userId,
      agentType: request.agentType,
      title: request.message.slice(0, 50) + (request.message.length > 50 ? "..." : ""),
    });
    conversationId = result.insertId;
    conversation = { id: conversationId, agentType: request.agentType };
  }

  // Save user message
  await createMessage({
    conversationId,
    role: "user",
    content: request.message,
  });

  // Build context
  const userContext = await buildUserContext(userId);
  const contextPrompt = formatContextForPrompt(userContext);

  // Get conversation history
  const history = await getMessagesByConversationId(conversationId, 20);

  // Get tools for this agent
  const tools = getToolsForAgent(request.agentType);
  const openaiTools = formatToolsForOpenAI(tools);

  // Build messages for OpenAI
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${AGENT_PROMPTS[request.agentType]}

---

KÄYTTÄJÄN KONTEKSTI:
${contextPrompt}

---

OHJEET:
1. Vastaa aina suomeksi ellei käyttäjä kysy englanniksi
2. Käytä työkaluja hakemaan tietoa kun tarpeen
3. Ole konkreettinen ja toimintaorientoitunut
4. Viittaa käyttäjän profiiliin ja dataan personoidaksesi vastauksia`,
    },
  ];

  // Add conversation history
  for (const msg of history.slice(-10)) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add current message (with file content if provided)
  let userMessageContent = request.message;
  
  if (request.fileBase64 && request.fileName) {
    // Parse CV content from base64
    try {
      const { parseCV } = await import("../cv-parser");
      const cvText = await parseCV(request.fileBase64, request.fileName);
      if (cvText) {
        userMessageContent = `${request.message}\n\n---\nLIITETTY CV (${request.fileName}):\n${cvText}\n---`;
      }
    } catch (e) {
      console.error("[Agent] CV parsing failed:", e);
      userMessageContent = `${request.message}\n\n[CV-tiedoston lukeminen epäonnistui: ${request.fileName}]`;
    }
  }

  messages.push({
    role: "user",
    content: userMessageContent,
  });

  // Call OpenAI with tools
  let response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools: openaiTools.length > 0 ? openaiTools : undefined,
    tool_choice: openaiTools.length > 0 ? "auto" : undefined,
    temperature: 0.7,
    max_tokens: 2000,
  });

  let assistantMessage = response.choices[0].message;
  let toolCalls: ToolCall[] = [];
  let toolResults: ToolResult[] = [];

  // Handle tool calls
  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Execute tools
    for (const toolCall of assistantMessage.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.function.name);
      if (tool) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await tool.execute(args, userContext);
          
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: args,
          });
          
          toolResults.push({
            toolCallId: toolCall.id,
            result,
          });

          // Add tool result to messages
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [toolCall],
          } as any);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`Tool execution error for ${toolCall.function.name}:`, error);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: "Tool execution failed" }),
          });
        }
      }
    }

    // Get next response
    response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: openaiTools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2000,
    });

    assistantMessage = response.choices[0].message;
  }

  // Save assistant message
  const savedMessage = await createMessage({
    conversationId,
    role: "assistant",
    content: assistantMessage.content || "",
    toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
    toolResults: toolResults.length > 0 ? JSON.stringify(toolResults) : null,
  });

  // Generate suggested follow-ups
  const suggestedFollowUps = generateFollowUps(request.agentType, request.message);

  return {
    conversationId,
    message: {
      id: savedMessage.insertId,
      conversationId,
      role: "assistant",
      content: assistantMessage.content || "",
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
      toolResults: toolResults.length > 0 ? toolResults : null,
      createdAt: new Date(),
    },
    suggestedFollowUps,
  };
}

function generateFollowUps(agentType: AgentType, lastMessage: string): string[] {
  const followUps: Record<AgentType, string[]> = {
    career_coach: [
      "Mitä taitoja minun kannattaisi kehittää?",
      "Miten voisin parantaa CV:täni?",
      "Mikä olisi seuraava askel urassani?",
    ],
    job_analyzer: [
      "Vertaile tätä muihin tallentamiini työpaikkoihin",
      "Mitä taitoja minulta puuttuu tähän?",
      "Onko tässä red flageja?",
    ],
    company_intel: [
      "Mitä muita yrityksiä suosittelisit?",
      "Millainen on yrityksen kasvuennuste?",
      "Ketkä ovat heidän kilpailijoita?",
    ],
    interview_prep: [
      "Generoi lisää teknisiä kysymyksiä",
      "Miten vastaan 'Miksi haluat tänne?'",
      "Harjoitellaan STAR-metodia",
    ],
    negotiator: [
      "Mikä on realistinen palkkahaarukka?",
      "Miten perustelen korkeampaa palkkaa?",
      "Mitä etuja kannattaa neuvotella?",
    ],
  };

  return followUps[agentType] || [];
}

export async function getConversations(userId: number, limit: number = 20) {
  const { getConversationsByUserId } = await import("../db");
  return getConversationsByUserId(userId, limit);
}

export async function getConversationMessages(conversationId: number, userId: number) {
  const { getConversation, getMessagesByConversationId } = await import("../db");
  
  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.userId !== userId) {
    throw new Error("Conversation not found");
  }

  const messages = await getMessagesByConversationId(conversationId, 100);
  return { conversation, messages };
}

export async function deleteConversation(conversationId: number, userId: number) {
  const { getConversation, deleteConversation: dbDelete } = await import("../db");
  
  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.userId !== userId) {
    throw new Error("Conversation not found");
  }

  await dbDelete(conversationId);
  return { success: true };
}

export { AGENTS };
