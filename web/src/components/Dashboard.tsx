"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { useChatSession } from "@/components/ChatSessionProvider";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ExploreTopics } from "@/components/ExploreTopics";
import { HistoryView } from "@/components/HistoryView";
import { MobileHeader, MobileNavigation } from "@/components/MobileHeader";
import { SavedAnswers } from "@/components/SavedAnswers";
import { Sidebar } from "@/components/Sidebar";
import { SupportedAgencies } from "@/components/SupportedAgencies";
import { getSavedAnswers, removeSavedAnswer, saveAnswer } from "@/lib/saved";
import type { ChatSession, SavedAnswer } from "@/types/clarify";

type DashboardView = "chat" | "history";

export function Dashboard() {
  const {
    currentChat,
    chats,
    storageReady,
    requestPending,
    interactionLocked,
    errorKind,
    activeAttachments,
    pendingAttachments,
    uploading,
    uploadError,
    submitMessage: sendMessage,
    retryFailedMessage,
    startNewChat: createNewChat,
    viewChat: selectChat,
    openLatestActiveChat: selectLatestActiveChat,
    clearConversationHistory: clearStoredHistory,
    handleUpload,
    removeAttachment,
  } = useChatSession();
  const [query, setQuery] = useState("");
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [view, setView] = useState<DashboardView>("chat");
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const routeSelectionApplied = useRef(false);

  const savedMessageIds = useMemo(() => new Set(savedAnswers.map((item) => item.messageId)), [savedAnswers]);

  useEffect(() => {
    if (!storageReady || routeSelectionApplied.current) return;
    const timer = window.setTimeout(() => {
      if (routeSelectionApplied.current) return;
      routeSelectionApplied.current = true;
      const urlParams = new URLSearchParams(window.location.search);
      const viewedChat = chats.find((chat) => chat.id === urlParams.get("chatId"));
      setSavedAnswers(getSavedAnswers());
      if (urlParams.get("view") === "history") setView("history");
      if (viewedChat) {
        selectChat(viewedChat);
        setFocusedMessageId(urlParams.get("messageId"));
        setView("chat");
      } else selectLatestActiveChat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [chats, selectChat, selectLatestActiveChat, storageReady]);

  async function submitMessage(value = query) {
    const clean = value.trim();
    if (!clean || interactionLocked) return;
    setQuery("");
    setFocusedMessageId(null);
    setView("chat");
    await sendMessage(clean);
  }

  function startNewChat() {
    setQuery("");
    setFocusedMessageId(null);
    setView("chat");
    createNewChat();
  }

  function viewChat(chat: ChatSession, messageId: string | null = null) {
    selectChat(chat);
    setQuery("");
    setFocusedMessageId(messageId);
    setView("chat");
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
    selectLatestActiveChat();
    setQuery("");
    setFocusedMessageId(null);
    setView("chat");
  }

  function clearConversationHistory() {
    if (interactionLocked) return;
    clearStoredHistory();
    setQuery("");
    setFocusedMessageId(null);
    setView("chat");
  }

  const needsReupload = activeAttachments.length === 0 && currentChat.messages.some((message) => message.attachmentContext?.length);
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
                <ChatPanel chat={currentChat} query={query} loading={requestPending} interactionLocked={interactionLocked} uploading={uploading} uploadError={uploadError} pendingAttachments={pendingAttachments} activeAttachmentCount={activeAttachments.length} needsReupload={needsReupload} errorKind={errorKind} focusedMessageId={focusedMessageId} savedMessageIds={savedMessageIds} onQueryChange={setQuery} onSubmit={submitMessage} onRetry={retryFailedMessage} onToggleSave={toggleSavedAnswer} onNewChat={startNewChat} onUpload={handleUpload} onRemoveAttachment={removeAttachment} />
              ) : (
                <HistoryView chats={chats} ready={storageReady} clearDisabled={interactionLocked} onOpen={viewChat} onClear={clearConversationHistory} />
              )}
            </div>
          </div>
        </main>

        <aside aria-label="Saved answers and topics" className="flex min-w-0 flex-col gap-3 border-l border-[#dfe6ed] bg-white px-3 py-4 sm:px-5 lg:min-h-0 lg:px-4 lg:py-5">
          <div className="order-2 shrink-0 lg:order-1"><SavedAnswers items={savedAnswers} ready={storageReady} disabled={false} onOpen={openSavedAnswer} onRemove={(messageId) => setSavedAnswers((items) => removeSavedAnswer(items, messageId))} /></div>
          <div className="order-1 min-h-[380px] lg:order-2 lg:min-h-0 lg:flex-1"><ExploreTopics disabled={interactionLocked} onSelect={submitMessage} /></div>
        </aside>

        <div className="bg-white px-3 pb-6 pt-1 sm:px-5 lg:hidden">
          <SupportedAgencies />
          <MobileNavigation {...navigationProps} />
        </div>
      </div>
    </div>
  );
}
