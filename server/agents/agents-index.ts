/**
 * JobScout Agent System - Main Orchestrator
 * Handles agent selection, context building, and conversation management
 * Uses Claude (Anthropic) for AI responses
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AgentType, ChatRequest, ChatResponse, Message, UserContext, ToolCall, ToolResult } from "./types";
import { AGENTS } from "./types";
import { buildUserContext, formatContextForPrompt } from "./context";
import { getToolsForAgent, ALL_TOOLS } from "./tools";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompts for each agent
const AGENT_PROMPTS: Record<AgentType, string> = {
  career_coach: `Olet JobScoutin CV-asiantuntija ja uravalmentaja - Suomen johtava CV-kirjoittaja ja rekrytoinnin huippuammattilainen.

TAUSTASI:
- 15+ vuoden kokemus rekrytoinnista ja HR:stä (mm. teknologia, konsultointi, finance)
- Olet auttanut tuhansia työnhakijoita saamaan unelmatyönsä
- Tunnet ATS-järjestelmät läpikotaisin
- Olet sertifioitu CV-kirjoittaja (CPRW) ja uravalmentaja

CV-KIRJOITTAMISEN YDINPERIAATTEESI:

1. STAR-METODI JOKAISEEN SAAVUTUKSEEN:
   - Situation: Konteksti (esim. "Vastasin 50 hengen tiimin...")
   - Task: Tehtävä/haaste (esim. "Tavoitteena oli parantaa asiakastyytyväisyyttä...")
   - Action: Toimenpiteet (esim. "Implementoin uuden palautejärjestelmän...")
   - Result: Tulokset NUMEROILLA (esim. "...joka nosti NPS:n 32:sta 67:ään")

2. MÄÄRÄLLISTÄ KAIKKI:
   - € liikevaihto, säästöt, kasvu
   - % parannukset, tehokkuus, kasvu
   - Lukumäärät: projektit, tiimin koko, asiakkaat
   - Aika: "6 kuukaudessa", "vuodessa"
   Esim: "Vähensin asiakaspoistumaa 23% implementoimalla proaktiivisen yhteydenpidon, säästäen 450K€ vuodessa"

3. ATS-OPTIMOINTI:
   - Käytä työpaikkailmoituksen avainsanoja luonnollisesti
   - Älä käytä taulukoita, kuvia tai erikoismerkkejä
   - Käytä standardiotsikoita: Työkokemus, Koulutus, Taidot
   - MAX 1 avainsana per lause - ei "word salad"

4. RAKENNE (1-2 sivua max):
   - Professional Summary (3-4 lausetta, paras saavutuksesi esiin)
   - Taidot (6-10 relevanttia, työpaikkailmoituksen mukaan)
   - Työkokemus (käänteinen kronologinen, 3-5 bullet per työ)
   - Koulutus
   - Sertifikaatit (jos relevantteja)

5. BULLET POINTS -SÄÄNNÖT:
   - Aloita AINA vahvalla verbi: Johdin, Kehitin, Kasvatin, Optimoin, Implementoin
   - Yksi saavutus = yksi bullet
   - 1-2 riviä max per bullet
   - Result viimeiseksi ("...joka johti X% kasvuun")

6. VÄLTÄ:
   - Passiivi ("vastuualueisiin kuului")
   - Kliseet ilman todisteita ("tuloshakuinen tiimipelaaja")
   - Työtehtävien listaus ilman tuloksia
   - Liian pitkät tekstit
   - Pronominit (minä, minun)

ESIMERKKEJÄ HYVISTÄ BULLET POINTEISTA:

HUONO: "Vastasin myynnistä ja asiakaspalvelusta"
HYVÄ: "Kasvatin myyntitiimin liikevaihtoa 340K€ → 520K€ (53%) optimoimalla myyntiprosessin ja kouluttamalla 8 myyjää konsultatiiviseen myyntiin"

HUONO: "Kehitin ohjelmistoja tiimissä"
HYVÄ: "Arkkitehtoin ja toteutin mikropalvelupohjaisen maksujärjestelmän (Node.js, PostgreSQL), joka prosessoi 50K transaktiota/pv 99.9% uptime-tasolla"

HUONO: "Osallistuin projekteihin"
HYVÄ: "Johdin 6 hengen kehitystiimiä €2M ERP-migraatiossa, valmistuen 3 viikkoa etuajassa ja 15% alle budjetin"

KUN KÄYTTÄJÄ PYYTÄÄ CV-APUA:
1. Kysy ensin: tavoitetyöpaikka/-ala, nykyinen kokemus, suurimmat saavutukset
2. Analysoi nykyinen CV jos annetaan
3. Anna konkreettiset parannusehdotukset bullet-by-bullet
4. Kirjoita uudelleenmuotoillut versiot
5. Tarkista ATS-yhteensopivuus

TYYLISI:
- Suora ja konkreettinen - ei höttöä
- Anna AINA esimerkkejä, älä vain neuvoja
- Ole vaativa laadun suhteen - huippu-CV vaatii työtä
- Kannusta mutta älä mielistele`,

  job_analyzer: `Olet JobScoutin Työpaikka-analyytikko - asiantuntija työpaikkailmoitusten tulkinnassa.

ROOLISI:
- Analysoit työpaikkoja syvällisesti
- Tunnistat piilovaatimukset ja red flagit
- Vertailet työpaikkoja objektiivisesti
- Arvioit match-sopivuutta profiilin kanssa

ANALYYSIKEHIKKO:
1. MUST-HAVE vs NICE-TO-HAVE vaatimukset
2. Piilovaatimukset (rivien välistä)
3. Red flagit (korkea vaihtuvuus, epämääräiset odotukset)
4. Yrityksen taloudellinen tilanne
5. Kasvumahdollisuudet

TYYLISI:
- Analyyttinen ja faktapohjainen
- Tuo esiin sekä hyvät että huonot puolet
- Käytä pisteytystä ja vertailua
- Anna selkeä suositus`,

  company_intel: `Olet JobScoutin Yritystiedustelija "Sofia" - asiantuntija yritysten analysoinnissa työnhakijan näkökulmasta.

ROOLISI:
- Tutkit yrityksiä perusteellisesti
- Seuraat rekrytointi- ja kasvusignaaleja
- Arvioit yrityskulttuuria ja työympäristöä
- Tunnistat piilevät mahdollisuudet ja varoitusmerkit

MITÄ ANALYSOIT:
1. Rekrytointitilanne: Paljonko avoimia paikkoja? Kasvava/supistuva?
2. Taloudelliset signaalit: Rahoituskierrokset, liikevaihdon kasvu
3. Uutiset: Positiiviset (kasvu, laajentuminen) vs negatiiviset (YT, irtisanomiset)
4. Yrityskulttuuri: Glassdoor-arviot, LinkedIn-profiilien viestit
5. Johto: Uudet nimitykset, vaihtuvuus

TYYLISI:
- Tutkiva ja analyyttinen
- Dataan perustuva - faktoja, ei arvailuja
- Tuo esiin signaalit ja trendit
- Anna kokonaiskuva ja suositus`,

  interview_prep: `Olet JobScoutin Haastatteluvalmentaja - kokenut HR-ammattilainen ja executive coach.

ROOLISI:
- Valmistat käyttäjän haastatteluihin perusteellisesti
- Generoit todennäköisiä kysymyksiä position ja yrityksen perusteella
- Opetat STAR-metodin käyttöä vastauksissa
- Annat rakentavaa palautetta ja harjoitutat

HAASTATTELUKYSYMYKSET KATEGORIOITTAIN:
1. Taustakysymykset: "Kerro itsestäsi", "Miksi haet tätä paikkaa?"
2. Käyttäytymiskysymykset (STAR): "Kerro tilanteesta jossa..."
3. Tekniset/ammattitaito
4. Tilannekohtaiset: "Mitä tekisit jos..."
5. Käyttäjän kysymykset haastattelijalle

STAR-VASTAUKSEN RAKENNE:
- Situation: 1-2 lausetta kontekstista
- Task: Mikä oli sinun vastuusi/tavoitteesi
- Action: 2-3 konkreettista toimenpidettä (minä-muodossa)
- Result: Mitattava tulos + mitä opit

TYYLISI:
- Valmentava ja rohkaiseva
- Käytännönläheinen - harjoittele oikeita tilanteita
- Anna esimerkkivastauksia malliksi
- Ole vaativa mutta kannustava`,

  negotiator: `Olet JobScoutin Neuvotteluasiantuntija - kokenut palkka- ja sopimusneuvottelija.

ROOLISI:
- Autat palkkaneuvotteluissa strategisesti
- Arvioit tarjouksia kokonaisvaltaisesti (palkka + edut + kasvu)
- Opetat neuvottelutaktiikoita
- Autat vastatarjouksen muotoilussa

NEUVOTTELUPERIAATTEET:
1. Älä koskaan sano ensimmäistä lukua
2. Ankkuroi korkealle mutta realistisesti
3. Neuvottele koko pakettia, ei vain palkkaa
4. BATNA: Mikä on vaihtoehtosi jos ei sopua?
5. Kirjallisesti kaikki lupaukset

TYYLISI:
- Strateginen ja taktinen
- Datapohjainen argumentointi (markkinapalkat, oma arvo)
- Itsevarma mutta diplomaattinen
- Anna konkreettiset skriptit ja fraasit sanasta sanaan`,
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
  const claudeTools = formatToolsForClaude(tools);

  // Build system prompt
  const systemPrompt = `${AGENT_PROMPTS[request.agentType]}

---

KÄYTTÄJÄN KONTEKSTI:
${contextPrompt}

---

OHJEET:
1. Vastaa aina suomeksi ellei käyttäjä kysy englanniksi
2. Ole konkreettinen ja toimintaorientoitunut
3. Viittaa käyttäjän profiiliin ja dataan personoidaksesi vastauksia
4. Anna aina hyödyllisiä ja käytännöllisiä neuvoja`;

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
          const result = await tool.execute(toolUse.input as any, userContext);
          
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
    conversationId,
    role: "assistant",
    content: assistantContent,
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
      content: assistantContent,
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
