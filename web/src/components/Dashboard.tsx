"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ExploreTopics } from "@/components/ExploreTopics";
import { HistoryView } from "@/components/HistoryView";
import { MobileHeader, MobileNavigation } from "@/components/MobileHeader";
import { SavedAnswers } from "@/components/SavedAnswers";
import { Sidebar } from "@/components/Sidebar";
import { SupportedAgencies } from "@/components/SupportedAgencies";
import { askQuestion } from "@/lib/api";
import { uploadAttachment } from "@/lib/attachments-api";
import { DEFAULT_CHAT_TITLE, generateChatTitle, isMeaningfulMessage } from "@/lib/chat-title";
import { clearHistory, createDraftChat, createMessageId, getChats, getLatestActiveChatId, saveChat, setLatestActiveChat } from "@/lib/history";
import { getSavedAnswers, removeSavedAnswer, saveAnswer } from "@/lib/saved";
import { ClarifyApiError, type ApiErrorKind, type ChatMessage, type ChatSession, type SavedAnswer, type UploadedAttachment } from "@/types/clarify";

type DashboardView = "chat" | "history";

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [currentChat, setCurrentChat] = useState<ChatSession>(() => createDraftChat());
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [latestActiveChatId, setLatestActiveChatId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>("chat");
  const [loading, setLoading] = useState(false);
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);
  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const savedMessageIds = useMemo(() => new Set(savedAnswers.map((item) => item.messageId)), [savedAnswers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedChats = getChats();
      const storedActiveChatId = getLatestActiveChatId();
      const activeChat = storedChats.find((chat) => chat.id === storedActiveChatId) ?? storedChats[0];
      const urlParams = new URLSearchParams(window.location.search);
      const viewedChat = storedChats.find((chat) => chat.id === urlParams.get("chatId"));
      if (urlParams.get("view") === "history") setView("history");
      setChats(storedChats);
      setSavedAnswers(getSavedAnswers());
      if (activeChat) {
        setLatestActiveChatId(activeChat.id);
        setLatestActiveChat(activeChat.id);
      }
      if (viewedChat) {
        setCurrentChat(viewedChat);
        setFocusedMessageId(urlParams.get("messageId"));
      } else if (activeChat) setCurrentChat(activeChat);
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function persistChat(chat: ChatSession) {
    setChats((items) => saveChat(items, chat));
    setLatestActiveChatId(chat.id);
    setLatestActiveChat(chat.id);
  }

  async function completeAssistantReply(chat: ChatSession, userMessage: ChatMessage, context: ChatMessage[]) {
    setLoading(true);
    setErrorKind(null);
    try {
      const response = await askQuestion({ chatId: chat.id, message: userMessage.content, messages: context, attachmentIds: attachments.map((item) => item.attachment_id) });
      const now = new Date().toISOString();
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: response.answer,
        agency: response.agency,
        status: response.status,
        citations: response.citations,
        recommendedForms: response.recommended_forms,
        suggestedFollowUps: response.suggested_follow_ups,
        createdAt: now,
      };
      const completedChat = { ...chat, messages: [...chat.messages, assistantMessage], updatedAt: now };
      setCurrentChat(completedChat);
      persistChat(completedChat);
      setFailedMessageId(null);
    } catch (error) {
      const kind = error instanceof ClarifyApiError ? error.kind : "network";
      setErrorKind(kind);
      if (kind === "attachment_expired") setAttachments([]);
      setFailedMessageId(userMessage.id);
    } finally {
      setLoading(false);
    }
  }

  async function submitMessage(value = query) {
    const clean = value.trim();
    if (!clean || loading) return;

    const now = new Date().toISOString();
    const attachmentContext = attachments.map(({ document_type, agency, form_name, form_code }) => ({ document_type, agency, form_name, form_code }));
    const userMessage: ChatMessage = { id: createMessageId(), role: "user", content: clean, attachmentContext: attachmentContext.length ? attachmentContext : undefined, createdAt: now };
    const shouldGenerateTitle = currentChat.title === DEFAULT_CHAT_TITLE && isMeaningfulMessage(clean);
    const chatWithQuestion: ChatSession = {
      ...currentChat,
      title: shouldGenerateTitle ? generateChatTitle(clean) : currentChat.title,
      messages: [...currentChat.messages, userMessage],
      updatedAt: now,
    };

    setQuery("");
    setFocusedMessageId(null);
    setFailedMessageId(userMessage.id);
    setCurrentChat(chatWithQuestion);
    persistChat(chatWithQuestion);
    setView("chat");
    await completeAssistantReply(chatWithQuestion, userMessage, currentChat.messages);
  }

  async function retryFailedMessage() {
    if (!failedMessageId || loading) return;
    const messageIndex = currentChat.messages.findIndex((message) => message.id === failedMessageId);
    const userMessage = currentChat.messages[messageIndex];
    if (!userMessage || userMessage.role !== "user") return;
    await completeAssistantReply(currentChat, userMessage, currentChat.messages.slice(0, messageIndex));
  }

  function startNewChat() {
    if (loading) return;
    setQuery("");
    setErrorKind(null);
    setFailedMessageId(null);
    setFocusedMessageId(null);
    setView("chat");
    setAttachments([]);
    setUploadError(null);
    if (currentChat.messages.length > 0) setCurrentChat(createDraftChat());
  }

  function viewChat(chat: ChatSession, messageId: string | null = null) {
    if (loading) return;
    setCurrentChat(chat);
    setQuery("");
    setErrorKind(null);
    setFailedMessageId(null);
    setFocusedMessageId(messageId);
    setView("chat");
    setAttachments([]);
    setUploadError(null);
  }

  function toggleSavedAnswer(messageId: string) {
    const existing = savedAnswers.find((item) => item.messageId === messageId);
    if (existing) {
      setSavedAnswers((items) => removeSavedAnswer(items, messageId));
      return;
    }

    const messageIndex = currentChat.messages.findIndex((message) => message.id === messageId);
    const assistantMessage = currentChat.messages[messageIndex];
    const userMessage = [...currentChat.messages.slice(0, messageIndex)].reverse().find((message) => message.role === "user");
    if (!assistantMessage || assistantMessage.role !== "assistant" || !userMessage) return;
    const saved: SavedAnswer = {
      id: `saved_${messageId}`,
      chatId: currentChat.id,
      messageId,
      query: userMessage.content,
      answer: assistantMessage.content,
      agency: assistantMessage.agency ?? "UNCLEAR",
      citations: assistantMessage.citations ?? [],
      recommendedForms: assistantMessage.recommendedForms ?? [],
      savedAt: new Date().toISOString(),
    };
    setSavedAnswers((items) => saveAnswer(items, saved));
  }

  function openSavedAnswer(item: SavedAnswer) {
    const originalChat = chats.find((chat) => chat.id === item.chatId);
    if (originalChat) viewChat(originalChat, item.messageId);
  }

  function openLatestActiveChat() {
    if (loading) return;
    const activeChat = chats.find((chat) => chat.id === latestActiveChatId);
    setCurrentChat(activeChat ?? createDraftChat());
    setQuery("");
    setErrorKind(null);
    setFailedMessageId(null);
    setFocusedMessageId(null);
    setView("chat");
    setAttachments([]);
    setUploadError(null);
  }

  function clearConversationHistory() {
    if (loading) return;
    clearHistory();
    setChats([]);
    setLatestActiveChatId(null);
    setCurrentChat(createDraftChat());
    setQuery("");
    setErrorKind(null);
    setFailedMessageId(null);
    setFocusedMessageId(null);
    setView("chat");
    setAttachments([]);
    setUploadError(null);
  }

  async function handleUpload(file: File) {
    if (uploading || loading || attachments.length >= 3) return;
    setUploading(true);
    setUploadError(null);
    setErrorKind(null);
    try {
      const uploaded = await uploadAttachment(file);
      setAttachments((items) => [...items, uploaded]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The form could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((items) => items.filter((item) => item.attachment_id !== attachmentId));
    setUploadError(null);
  }

  const needsReupload = attachments.length === 0 && currentChat.messages.some((message) => message.attachmentContext?.length);

  const navigationProps = {
    activeView: view,
    onOpenChat: openLatestActiveChat,
    onOpenHistory: () => setView("history" as const),
  };

  return (
    <div className="min-h-screen w-full bg-[#f5f8fb] text-[#10243e] lg:h-screen lg:min-h-[680px] lg:overflow-hidden">
      <div className="w-full bg-white lg:grid lg:h-full lg:grid-cols-[232px_minmax(0,1fr)_312px] xl:grid-cols-[240px_minmax(0,1fr)_328px]">
        <MobileHeader />
        <Sidebar {...navigationProps} />

        <main className="min-w-0 bg-[#f5f8fb] px-3 py-4 sm:px-5 lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-5 2xl:px-8">
          <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col gap-3.5">
            <DashboardHeader />
            <div id="chat" className="min-h-0 flex-1">
              {view === "chat" ? (
                <ChatPanel chat={currentChat} query={query} loading={loading} uploading={uploading} uploadError={uploadError} attachments={attachments} needsReupload={needsReupload} errorKind={errorKind} focusedMessageId={focusedMessageId} savedMessageIds={savedMessageIds} onQueryChange={setQuery} onSubmit={submitMessage} onRetry={retryFailedMessage} onToggleSave={toggleSavedAnswer} onNewChat={startNewChat} onUpload={handleUpload} onRemoveAttachment={removeAttachment} />
              ) : (
                <HistoryView chats={chats} ready={storageReady} disabled={loading} onOpen={viewChat} onClear={clearConversationHistory} />
              )}
            </div>
          </div>
        </main>

        <aside aria-label="Saved answers and topics" className="flex min-w-0 flex-col gap-3 border-l border-[#dfe6ed] bg-white px-3 py-4 sm:px-5 lg:min-h-0 lg:px-4 lg:py-5">
          <div className="order-2 shrink-0 lg:order-1"><SavedAnswers items={savedAnswers} ready={storageReady} disabled={loading} onOpen={openSavedAnswer} onRemove={(messageId) => setSavedAnswers((items) => removeSavedAnswer(items, messageId))} /></div>
          <div className="order-1 min-h-[380px] lg:order-2 lg:min-h-0 lg:flex-1"><ExploreTopics disabled={loading} onSelect={submitMessage} /></div>
        </aside>

        <div className="bg-white px-3 pb-6 pt-1 sm:px-5 lg:hidden">
          <SupportedAgencies />
          <MobileNavigation {...navigationProps} />
        </div>
      </div>
    </div>
  );
}
