import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { 
  Bot, 
  Send, 
  Loader2, 
  Upload, 
  FileText, 
  X, 
  ArrowLeft,
  Plus,
  MessageSquare,
  Trash2,
  Sparkles,
  Search,
  ExternalLink
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// Import agent images
import careerCoachImg from "@/assets/agents/jobscout_career_coach.png";
import jobAnalyzerImg from "@/assets/agents/jobscout_job_analyzer.png";
import companyIntelImg from "@/assets/agents/jobscout_company_intel.png";
import interviewPrepImg from "@/assets/agents/jobscout_interview_prep.png";
import negotiatorImg from "@/assets/agents/jobscout_negotiator.png";

// Agent definitions matching backend
const AGENTS = {
  career_coach: {
    id: "career_coach",
    name: "Kaisa",
    role: "Uravalmentaja",
    description: "Henkilökohtainen uravalmentaja ja mentori",
    avatar: careerCoachImg,
    color: "#10B981",
    gradient: "from-emerald-500 to-teal-600",
  },
  job_analyzer: {
    id: "job_analyzer",
    name: "Aleksi",
    role: "Ilmoitusanalyytikko",
    description: "Työpaikkailmoitusten asiantuntija-analyytikko",
    avatar: jobAnalyzerImg,
    color: "#3B82F6",
    gradient: "from-blue-500 to-indigo-600",
  },
  company_intel: {
    id: "company_intel",
    name: "Sofia",
    role: "Yritystutkija",
    description: "Yritysten taustatutkija ja kulttuurianalyytikko",
    avatar: companyIntelImg,
    color: "#8B5CF6",
    gradient: "from-violet-500 to-purple-600",
  },
  interview_prep: {
    id: "interview_prep",
    name: "Henrik",
    role: "Haastatteluvalmentaja",
    description: "Haastatteluvalmentaja ja esiintymiskouluttaja",
    avatar: interviewPrepImg,
    color: "#F59E0B",
    gradient: "from-amber-500 to-orange-600",
  },
  negotiator: {
    id: "negotiator",
    name: "Mikael",
    role: "Palkkaneuvottelija",
    description: "Palkka- ja sopimusneuvottelujen asiantuntija",
    avatar: negotiatorImg,
    color: "#EF4444",
    gradient: "from-red-500 to-rose-600",
  },
};

type AgentType = keyof typeof AGENTS;

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  agentType: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function Agents() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isParsingCV, setIsParsingCV] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: conversations, refetch: refetchConversations } = trpc.agent.conversations.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  const { data: conversationData, isLoading: loadingMessages } = trpc.agent.conversation.useQuery(
    { conversationId: selectedConversation! },
    { enabled: !!selectedConversation }
  );

  // Mutations
  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: data.message.content,
        createdAt: new Date().toISOString(),
      }]);
      if (!selectedConversation) {
        setSelectedConversation(data.conversationId);
      }
      refetchConversations();
    },
    onError: (error) => {
      toast.error("Viestin lähetys epäonnistui: " + error.message);
    },
  });

  const deleteMutation = trpc.agent.deleteConversation.useMutation({
    onSuccess: () => {
      toast.success("Keskustelu poistettu");
      setSelectedConversation(null);
      setMessages([]);
      refetchConversations();
    },
  });

  // Company search mutation (for Sofia)
  const companySearchMutation = trpc.search.company.useMutation({
    onSuccess: (data) => {
      // Format search results as a message
      let resultText = `🔍 **Hakutulokset: ${data.companyName}**\n\n`;
      
      if (data.generalInfo?.organic) {
        resultText += "**Yleistiedot:**\n";
        data.generalInfo.organic.slice(0, 3).forEach((r: any) => {
          resultText += `• [${r.title}](${r.link})\n  ${r.snippet || ""}\n\n`;
        });
      }
      
      if (data.linkedIn?.organic) {
        resultText += "**LinkedIn:**\n";
        data.linkedIn.organic.slice(0, 2).forEach((r: any) => {
          resultText += `• [${r.title}](${r.link})\n`;
        });
        resultText += "\n";
      }
      
      if (data.reviews?.organic) {
        resultText += "**Arvostelut:**\n";
        data.reviews.organic.slice(0, 2).forEach((r: any) => {
          resultText += `• [${r.title}](${r.link})\n  ${r.snippet || ""}\n`;
        });
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: resultText,
        createdAt: new Date().toISOString(),
      }]);
    },
    onError: (error) => {
      toast.error("Yrityshaku epäonnistui: " + error.message);
    },
  });

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationData?.messages) {
      setMessages(conversationData.messages.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt?.toString() || new Date().toISOString(),
      })));
      // Set the agent type from conversation
      if (conversationData.conversation.agentType) {
        setSelectedAgent(conversationData.conversation.agentType as AgentType);
      }
    }
  }, [conversationData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Vain PDF, DOCX tai TXT tiedostot sallittu");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Tiedosto on liian suuri (max 10MB)");
      return;
    }

    setUploadedFile(file);
    setIsParsingCV(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // For now, just store the base64 - backend will parse
      setFileContent(base64);
      toast.success(`CV "${file.name}" ladattu onnistuneesti`);
    } catch (error) {
      toast.error("Tiedoston lukeminen epäonnistui");
      setUploadedFile(null);
    } finally {
      setIsParsingCV(false);
    }
  }, []);

  // Handle drag & drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() && !fileContent) return;
    if (!selectedAgent) return;

    let messageContent = inputValue.trim();
    
    // If there's a file attached, prepend info about it
    if (fileContent && uploadedFile) {
      messageContent = `[CV liitetty: ${uploadedFile.name}]\n\nAnalysoi CV ja ${messageContent || "kerro päähavainnot"}`;
    }

    if (!messageContent) return;

    // Add user message to UI
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "user",
      content: messageContent,
      createdAt: new Date().toISOString(),
    }]);

    setInputValue("");
    setUploadedFile(null);
    setFileContent(null);

    // Send to backend
    chatMutation.mutate({
      conversationId: selectedConversation || undefined,
      agentType: selectedAgent,
      message: messageContent,
      fileBase64: fileContent || undefined,
      fileName: uploadedFile?.name || undefined,
    });
  };

  // Start new conversation
  const startNewConversation = (agentType: AgentType) => {
    setSelectedAgent(agentType);
    setSelectedConversation(null);
    setMessages([]);
    setUploadedFile(null);
    setFileContent(null);
  };

  // Back to agent selection
  const goBack = () => {
    setSelectedAgent(null);
    setSelectedConversation(null);
    setMessages([]);
    setUploadedFile(null);
    setFileContent(null);
  };

  // Filter conversations for selected agent
  const agentConversations = conversations?.filter(
    c => c.agentType === selectedAgent
  ) || [];

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col pt-4">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container max-w-6xl py-4 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {selectedAgent && (
                  <Button variant="ghost" size="icon" onClick={goBack}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden",
                    selectedAgent ? "" : "bg-gradient-to-br from-blue-500 to-purple-600"
                  )}>
                    {selectedAgent ? (
                      <img src={AGENTS[selectedAgent].avatar} alt={AGENTS[selectedAgent].name} className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-lg md:text-xl font-bold">
                      {selectedAgent ? AGENTS[selectedAgent].name : "AI-agentit"}
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {selectedAgent ? AGENTS[selectedAgent].role : "Valitse agentti aloittaaksesi"}
                    </p>
                  </div>
                </div>
              </div>
              {/* Mobile: New conversation button */}
              {selectedAgent && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="md:hidden"
                  onClick={() => startNewConversation(selectedAgent)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedAgent ? (
            // Agent Selection Grid
            <div className="container max-w-6xl py-8 px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {Object.entries(AGENTS).map(([key, agent]) => (
                  <Card 
                    key={key}
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-primary/50 overflow-hidden"
                    onClick={() => startNewConversation(key as AgentType)}
                  >
                    <div className="relative h-32 sm:h-40 overflow-hidden">
                      <img 
                        src={agent.avatar} 
                        alt={agent.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          // Fallback to gradient if image fails
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className={cn(
                        "hidden w-full h-full bg-gradient-to-br flex items-center justify-center text-white text-4xl font-bold",
                        agent.gradient
                      )}>
                        {agent.name.charAt(0)}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <h3 className="text-white font-bold text-lg">{agent.name}</h3>
                        <p className="text-white/80 text-sm">{agent.role}</p>
                      </div>
                    </div>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">{agent.description}</p>
                      <Button className="w-full mt-4" variant="outline">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Aloita keskustelu
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recent Conversations */}
              {conversations && conversations.length > 0 && (
                <div className="mt-12">
                  <h2 className="text-lg font-semibold mb-4">Viimeaikaiset keskustelut</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {conversations.slice(0, 6).map(conv => {
                      const agent = AGENTS[conv.agentType as AgentType];
                      if (!agent) return null;
                      return (
                        <Card 
                          key={conv.id}
                          className="cursor-pointer hover:shadow-md transition-all"
                          onClick={() => {
                            setSelectedAgent(conv.agentType as AgentType);
                            setSelectedConversation(conv.id);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden">
                                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{conv.title || "Uusi keskustelu"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {agent.name} • {new Date(conv.updatedAt).toLocaleDateString('fi-FI')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Chat Interface
            <div className="flex h-full">
              {/* Conversation Sidebar - hidden on mobile */}
              <div className="hidden md:flex w-64 border-r bg-muted/30 flex-col">
                <div className="p-3 border-b">
                  <Button 
                    className="w-full" 
                    onClick={() => startNewConversation(selectedAgent)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Uusi keskustelu
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {agentConversations.map(conv => (
                      <div
                        key={conv.id}
                        className={cn(
                          "p-3 rounded-lg cursor-pointer transition-colors group",
                          selectedConversation === conv.id 
                            ? "bg-primary/10 border border-primary/20" 
                            : "hover:bg-muted"
                        )}
                        onClick={() => setSelectedConversation(conv.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate flex-1">
                            {conv.title || "Uusi keskustelu"}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate({ conversationId: conv.id });
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(conv.updatedAt).toLocaleDateString('fi-FI')}
                        </p>
                      </div>
                    ))}
                    {agentConversations.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Ei keskusteluja vielä
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="max-w-3xl mx-auto space-y-4">
                    {loadingMessages ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-20 w-full" />
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 rounded-3xl mx-auto mb-4 overflow-hidden">
                          <img src={AGENTS[selectedAgent].avatar} alt={AGENTS[selectedAgent].name} className="w-full h-full object-cover" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          Hei! Olen {AGENTS[selectedAgent].name}
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto mb-6">
                          {AGENTS[selectedAgent].description}. Voit ladata CV:si analysointia varten tai 
                          aloittaa keskustelun suoraan.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Lataa CV
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setInputValue("Kerro itsestäsi ja miten voit auttaa minua?")}
                          >
                            Esittele itsesi
                          </Button>
                          {selectedAgent === "company_intel" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const company = prompt("Minkä yrityksen tietoja haluat hakea?");
                                if (company) {
                                  setMessages(prev => [...prev, {
                                    id: Date.now(),
                                    role: "user",
                                    content: `Hae tietoja yrityksestä: ${company}`,
                                    createdAt: new Date().toISOString(),
                                  }]);
                                  companySearchMutation.mutate({ companyName: company });
                                }
                              }}
                            >
                              <Search className="w-4 h-4 mr-2" />
                              Hae yritystietoja
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-3",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          {msg.role === "assistant" && (
                            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                              <img src={AGENTS[selectedAgent].avatar} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex flex-col gap-2 max-w-[80%]">
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-3",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.role === "assistant" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="self-start text-xs text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  // Extract key terms from the message for Google search
                                  const searchQuery = msg.content.slice(0, 100).replace(/[^\w\sÄÖÅäöå]/g, ' ').trim();
                                  window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
                                }}
                              >
                                <Search className="w-3 h-3 mr-1" />
                                Hae Googlesta
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {chatMutation.isPending && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden">
                          <img src={AGENTS[selectedAgent].avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="bg-muted rounded-2xl px-4 py-3">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div 
                  className="border-t p-4 bg-background"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="max-w-3xl mx-auto px-2 md:px-0">
                    {/* File Upload Preview */}
                    {uploadedFile && (
                      <div className="mb-3 p-3 bg-muted rounded-lg flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFile.size / 1024).toFixed(1)} KB
                            {isParsingCV && " • Käsitellään..."}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setUploadedFile(null);
                            setFileContent(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Input Row */}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsingCV}
                        title="Lataa CV (PDF, DOCX, TXT)"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={uploadedFile ? "Mitä haluat tietää CV:stäsi?" : "Kirjoita viesti..."}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={chatMutation.isPending}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={chatMutation.isPending || (!inputValue.trim() && !fileContent)}
                      >
                        {chatMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Vedä ja pudota CV tähän tai klikkaa upload-nappia
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
