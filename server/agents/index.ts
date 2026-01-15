/**
 * JobScout Agent System - Main Orchestrator
 * Handles agent selection, context building, and conversation management
 * Uses Claude (Anthropic) for AI responses
 *
 * Integrated with Message Bus for inter-agent communication.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AgentType, ChatRequest, ChatResponse, Message, UserContext, ToolCall, ToolResult } from "./types";
import { AGENTS } from "./types";
import { buildUserContext, formatContextForPrompt } from "./context";
import { getToolsForAgent, ALL_TOOLS } from "./tools";
import {
  createRunContext,
  registerRun,
  unregisterRun,
  SharedKnowledge,
  AgentMessenger,
  type RunContext
} from "./core";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompts for each agent
const AGENT_PROMPTS: Record<AgentType, string> = {
  career_coach: `Olet JobScoutin Uravalmentaja - kokenut rekrytoinnin ja uraohjauksen ammattilainen.

ROOLISI:
- Autat käyttäjää kehittämään uraansa strategisesti
- Annat konkreettisia neuvoja CV:n ja profiilin parantamiseen
- Tunnistat kehityskohteet ja suosittelet toimenpiteitä
- Olet kannustava mutta rehellinen

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

TYYLISI:
- Strateginen ja taktinen
- Datapohjainen argumentointi
- Itsevarma mutta diplomaattinen
- Konkreettiset skriptit ja fraasit`,

  signal_scout: `Olet Väinö - JobScoutin signaalitietäjä ja rekrytointien ennustaja.

Nimesi tulee Kalevalan tietäjä Väinämöisestä, joka näki tulevaisuuteen. Sinä näet rekrytoinnit ENNEN kuin ne tapahtuvat.

🎯 ROOLISI:
Olet markkinoiden ainoa AI joka yhdistää KAIKKI julkiset signaalit ennustaaksesi rekrytointeja ENNEN kuin paikat julkaistaan. Tämä antaa käyttäjille 2-4 viikon etumatkan.

📊 SIGNAALIT JOITA SEURAAT:

1. YTJ/PRH VIRALLINEN YRITYSREKISTERI (Suomi) ⭐
   - Y-tunnus, perustamispäivä, yritysmuoto
   - Kotipaikka ja toimialat
   - Rekisteröinnit ja muutokset
   - LUOTETTAVIN datalähde Suomessa
   
2. UUTISET & LEHDISTÖTIEDOTTEET
   - "Rahoituskierros" → massiivinen rekry 3-6kk
   - "Laajentuminen" → uusia tiimejä
   - "Uusi toimitusjohtaja/CTO" → strategiamuutos
   - "YT-neuvottelut" → EI rekrytoi (varoitus)

3. TWITTER/X-SIGNAALIT ⭐
   - Rekrytointi-ilmoitukset sosiaalisessa mediassa
   - "We're hiring" -viestit
   - Yrityskulttuuripäivitykset
   - Tiimin kasvusignaalit

4. GLASSDOOR-ARVOSTELUT ⭐
   - Työntekijätyytyväisyys (rating 1-5)
   - Positiivinen rating = hyvä työnantaja
   - Negatiivinen rating = vaikea rekrytoida

5. GITHUB-AKTIVITEETTI (tech-yritykset)
   - Repo-aktiviteetti 5x → tech-tiimi kasvaa
   - Hiring-label issuet → suora signaali

🧮 ENNUSTEMALLI:
Lasket jokaiselle yritykselle:
- hiring_probability: 0-100% (perustuu KAIKKIIN signaaleihin)
- confidence: low/medium/high (riippuu datan määrästä)
- timing: 30/60/90/180 päivää
- role_types: mitkä roolit todennäköisiä

🎯 TYÖKALUJESI KÄYTTÖ:

ENSISIJAINEN TYÖKALU:
→ **analyze_company_signals_v2** - Käytä AINA tätä ensimmäisenä!
  Kerää automaattisesti: YTJ, Uutiset, Twitter, Glassdoor
  Antaa kokonaisvaltaisen analyysin yhdellä kutsulla.

LISÄTYÖKALUT (tarvittaessa):
→ **get_ytj_company_data** - Jos haluat VAIN YTJ-dataa
→ **search_twitter_signals** - Syvällisempi Twitter-analyysi
→ **search_glassdoor_reviews** - Lisää työntekijäkokemuksista
→ **search_news_signals** - Erikseen uutishaku
→ **get_hiring_prediction** - Rooli-kohtainen ennuste

📋 VASTAUKSISSASI:

1. OLE KONKREETTINEN
   ✅ "Reaktor: 78% todennäköisyys, senior backend 60pv"
   ❌ "Reaktor vaikuttaa hyvältä yritykseltä"

2. NÄYTÄ SIGNAALIT & DATALÄHTEET
   ✅ "Perustuu 4 lähteeseen: YTJ (virallinen), 3 uutista, 5 twiittiä, Glassdoor 4.2/5"
   ❌ "Olen laskenut että..."

3. ANNA TOIMINTAOHJEET
   ✅ "Ota yhteyttä HR-johtajaan nyt - ikkunan on auki 2-3 viikkoa"
   ❌ "Kannattaa ehkä harkita hakemista"

4. PRIORISOI
   ✅ "TOP 3 yritystä sinulle: 1) Reaktor (85%), 2) Futurice (72%), 3) Vincit (68%)"

🎨 PERSOONALLISUUTESI:
- Viisas ja rauhallinen - tietäjän varmuus
- Datavetoinen - perustelet AINA signaaleihin
- Läpinäkyvä - kerrot mistä tieto tulee
- Proaktiivinen - ehdotat toimenpiteitä

⚡ PUHETYYLISI:
- "YTJ-rekisteristä näen, että..."
- "Virallinen data vahvistaa..."
- "Twitter paljastaa rekrytointisignaaleja..."
- "Glassdoor-arvostelut kertovat..."
- "Yhdistän 4 datalähteen signaalit..."

⚠️ TÄRKEÄÄ:
- KÄYTÄ AINA analyze_company_signals_v2 ENSIN
- VIITTAA LÄHTEISIIN (YTJ, Twitter, Glassdoor...)
- OLE REHELLINEN jos dataa vähän

🤝 AGENTTIEN YHTEISTYÖ:

Sinulla on tiimi avuksi! Kun signaalit ovat vahvat, kutsu muita agentteja:

→ **request_career_coach** - Kun käyttäjä tarvitsee uraohjausta
  "Vahva signaali Reaktorilla - pyydän Career Coachilta neuvoja profiiliin"

→ **request_negotiator** - Kun vahva signaali → neuvottelustrategia
  "Score 85% - Negotiator suosittelee aggressiivisempaa palkkaneuvottelua"

→ **request_interview_prep** - Kun haastattelukutsu todennäköinen
  "Reaktor rekrytoi 30-60pv sisällä - Interview Prep valmistelee sinut"

KÄYTÄ NÄITÄ AUTOMAATTISESTI kun:
- Score >= 75% → Kutsu Negotiator + Interview Prep
- Käyttäjä kysyy "mitä teen?" → Kutsu Career Coach
- Käyttäjä haluaa hakea → Kutsu Interview Prep

Olet käyttäjän henkilökohtainen tietäjä - näet mitä muut eivät näe. 🔮`,
};

// Format tools for Claude
function formatToolsForClaude(tools: any[]): Anthropic.Tool[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: tool.parameters.properties || {},
      required: tool.parameters.required || [],
    },
  }));
}

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
    conversationId: conversationId!,
    role: "user",
    content: request.message,
  });

  // === CREATE RUN CONTEXT ===
  // RunContext provides isolated context for this agent interaction
  const runCtx = createRunContext(userId, conversationId);
  registerRun(runCtx);
  runCtx.setCurrentAgent(request.agentType);

  console.log(`[Agent] Started run ${runCtx.runId} for agent ${request.agentType}`);

  // Build context
  const userContext = await buildUserContext(userId);

  // Attach runId to context so tools can access it
  (userContext as any)._runId = runCtx.runId;

  const contextPrompt = formatContextForPrompt(userContext);

  // Get shared knowledge context from previous interactions
  const sharedKnowledgeContext = SharedKnowledge.buildContextSummary(runCtx.runId);

  // Get conversation history
  const history = await getMessagesByConversationId(conversationId!, 20);

  // Get tools for this agent
  const tools = getToolsForAgent(request.agentType);
  const claudeTools = formatToolsForClaude(tools);

  // Build system prompt with shared knowledge
  const systemPrompt = `${AGENT_PROMPTS[request.agentType]}

---

KÄYTTÄJÄN KONTEKSTI:
${contextPrompt}

${sharedKnowledgeContext ? `---

JAETTU TIETO (Muilta Agenteilta):
${sharedKnowledgeContext}
` : ''}
---

OHJEET:
1. Vastaa aina suomeksi ellei käyttäjä kysy englanniksi
2. Ole konkreettinen ja toimintaorientoitunut
3. Viittaa käyttäjän profiiliin ja dataan personoidaksesi vastauksia
4. Anna aina hyödyllisiä ja käytännöllisiä neuvoja
5. Hyödynnä JAETTU TIETO -osiota jos siinä on relevanttia dataa muilta agenteilta`;

  // Build messages for Claude
  const messages: Anthropic.MessageParam[] = [];

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

  // Call Claude
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    tools: claudeTools.length > 0 ? claudeTools : undefined,
  });

  let toolCalls: ToolCall[] = [];
  let toolResults: ToolResult[] = [];

  // Handle tool use
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    // Process each tool call
    for (const toolUse of toolUseBlocks) {
      const tool = tools.find(t => t.name === toolUse.name);
      if (tool) {
        try {
          // Check if result is cached in RunContext
          const cachedResult = runCtx.getCachedToolResult(toolUse.name, toolUse.input);
          let result;

          if (cachedResult) {
            result = cachedResult;
            console.log(`[Agent] Cache hit for tool ${toolUse.name}`);
          } else {
            result = await tool.execute(toolUse.input as any, userContext);
            // Cache the result in RunContext
            runCtx.recordToolUse(toolUse.name, toolUse.input, result, false);
          }

          toolCalls.push({
            id: toolUse.id,
            name: toolUse.name,
            arguments: toolUse.input as any,
          });

          toolResults.push({
            toolCallId: toolUse.id,
            result,
          });

          // Add assistant message with tool use
          messages.push({
            role: "assistant",
            content: response.content,
          });

          // Add tool result
          messages.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            }],
          });
        } catch (error) {
          console.error(`Tool execution error for ${toolUse.name}:`, error);
          messages.push({
            role: "assistant",
            content: response.content,
          });
          messages.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: "Tool execution failed" }),
              is_error: true,
            }],
          });
        }
      }
    }

    // Get next response
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: claudeTools,
    });
  }

  // Extract text from response
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const assistantContent = textBlocks.map(b => b.text).join("\n");

  // Save assistant message
  const savedMessage = await createMessage({
    conversationId: conversationId!,
    role: "assistant",
    content: assistantContent,
    toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
    toolResults: toolResults.length > 0 ? JSON.stringify(toolResults) : null,
  });

  // Generate suggested follow-ups
  const suggestedFollowUps = generateFollowUps(request.agentType, request.message);

  // === COMPLETE RUN CONTEXT ===
  runCtx.completeAgentExecution();
  const runSummary = runCtx.getSummary();
  console.log(`[Agent] Completed run ${runCtx.runId}: ${runSummary.toolsUsed.length} tools used, ${runSummary.duration}ms`);

  // Get any discovered signals to include in response
  const discoveredSignals = runCtx.getDiscoveredSignals();

  // Don't cleanup yet - keep the context for follow-up questions in the same conversation
  // The context will be cleaned up after conversation timeout or explicit cleanup

  return {
    conversationId,
    message: {
      id: savedMessage.insertId,
      conversationId,
      role: "assistant",
      content: assistantContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
      toolResults: toolResults.length > 0 ? toolResults : null,
      createdAt: new Date(),
    },
    suggestedFollowUps,
    // Include run metadata for debugging/analytics
    _runMetadata: {
      runId: runCtx.runId,
      duration: runSummary.duration,
      toolsUsed: runSummary.toolsUsed,
      signalsDiscovered: discoveredSignals.length,
    },
  } as ChatResponse;
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
    signal_scout: [
      "Analysoi toinen yritys",
      "Mitkä signaalit ovat vahvimpia?",
      "Milloin minun kannattaisi ottaa yhteyttä?",
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
