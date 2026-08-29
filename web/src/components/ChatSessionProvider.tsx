"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { askQuestion } from "@/lib/api";
import { uploadAttachment } from "@/lib/attachments-api";
import { DEFAULT_CHAT_TITLE, generateChatTitle, isMeaningfulMessage } from "@/lib/chat-title";
import { clearHistory, createDraftChat, createMessageId, getChats, getLatestActiveChatId, saveChat, setLatestActiveChat } from "@/lib/history";
import { ClarifyApiError, type ApiErrorKind, type ChatMessage, type ChatSession, type UploadedAttachment } from "@/types/clarify";

interface ChatAttachmentState {
  active: UploadedAttachment[];
  pendingDisplay: UploadedAttachment[];
}

interface ChatRequestState {
  pending: boolean;
  errorKind: ApiErrorKind | null;
  failedMessageId: string | null;
}

interface ChatSessionContextValue {
  currentChat: ChatSession;
  chats: ChatSession[];
  latestActiveChatId: string | null;
  storageReady: boolean;
  requestPending: boolean;
  interactionLocked: boolean;
  errorKind: ApiErrorKind | null;
  failedMessageId: string | null;
  activeAttachments: UploadedAttachment[];
  pendingAttachments: UploadedAttachment[];
  uploading: boolean;
  uploadError: string | null;
  submitMessage: (value: string) => Promise<void>;
  retryFailedMessage: () => Promise<void>;
  startNewChat: () => void;
  viewChat: (chat: ChatSession) => void;
  openLatestActiveChat: () => void;
  clearConversationHistory: () => void;
  handleUpload: (file: File) => Promise<void>;
  removeAttachment: (attachmentId: string) => void;
}

const EMPTY_ATTACHMENT_STATE: ChatAttachmentState = { active: [], pendingDisplay: [] };
const EMPTY_REQUEST_STATE: ChatRequestState = { pending: false, errorKind: null, failedMessageId: null };
const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [currentChat, setCurrentChat] = useState<ChatSession>(() => createDraftChat());
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [latestActiveChatId, setLatestActiveChatId] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [requestStateByChat, setRequestStateByChat] = useState<Record<string, ChatRequestState>>({});
  const [attachmentsByChat, setAttachmentsByChat] = useState<Record<string, ChatAttachmentState>>({});
  const [uploadingChatId, setUploadingChatId] = useState<string | null>(null);
  const [uploadErrorsByChat, setUploadErrorsByChat] = useState<Record<string, string>>({});

  const requestState = requestStateByChat[currentChat.id] ?? EMPTY_REQUEST_STATE;
  const chatAttachments = attachmentsByChat[currentChat.id] ?? EMPTY_ATTACHMENT_STATE;
  const anyRequestPending = Object.values(requestStateByChat).some((state) => state.pending);
  const interactionLocked = anyRequestPending || uploadingChatId !== null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedChats = getChats();
      const storedActiveChatId = getLatestActiveChatId();
      const activeChat = storedChats.find((chat) => chat.id === storedActiveChatId) ?? storedChats[0];
      const urlParams = new URLSearchParams(window.location.search);
      const viewedChat = storedChats.find((chat) => chat.id === urlParams.get("chatId"));
      setChats(storedChats);
      if (activeChat) {
        setLatestActiveChatId(activeChat.id);
        setLatestActiveChat(activeChat.id);
      }
      if (viewedChat) setCurrentChat(viewedChat);
      else if (activeChat) setCurrentChat(activeChat);
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateRequestState(chatId: string, update: Partial<ChatRequestState>) {
    setRequestStateByChat((items) => ({
      ...items,
      [chatId]: { ...(items[chatId] ?? EMPTY_REQUEST_STATE), ...update },
    }));
  }

  function updateChatAttachments(chatId: string, update: (current: ChatAttachmentState) => ChatAttachmentState) {
    setAttachmentsByChat((items) => {
      const next = update(items[chatId] ?? EMPTY_ATTACHMENT_STATE);
      if (next.active.length === 0 && next.pendingDisplay.length === 0) {
        const remaining = { ...items };
        delete remaining[chatId];
        return remaining;
      }
      return { ...items, [chatId]: next };
    });
  }

  function clearChatAttachments(chatId: string) {
    setAttachmentsByChat((items) => {
      if (!items[chatId]) return items;
      const remaining = { ...items };
      delete remaining[chatId];
      return remaining;
    });
  }

  function clearPendingAttachmentDisplay(chatId: string) {
    updateChatAttachments(chatId, (current) => ({ ...current, pendingDisplay: [] }));
  }

  function persistStartedChat(chat: ChatSession) {
    setChats((items) => saveChat(items, chat));
    setLatestActiveChatId(chat.id);
    setLatestActiveChat(chat.id);
  }

  function persistCompletedChat(chat: ChatSession) {
    setChats((items) => saveChat(items, chat));
    setCurrentChat((viewedChat) => viewedChat.id === chat.id ? chat : viewedChat);
  }

  async function completeAssistantReply(chat: ChatSession, userMessage: ChatMessage, context: ChatMessage[], attachmentIds: string[]) {
    const requestChatId = chat.id;
    updateRequestState(requestChatId, { pending: true, errorKind: null, failedMessageId: userMessage.id });
    try {
      const response = await askQuestion({ chatId: requestChatId, message: userMessage.content, messages: context, attachmentIds });
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
      persistCompletedChat(completedChat);
      updateRequestState(requestChatId, { pending: false, errorKind: null, failedMessageId: null });
    } catch (error) {
      const kind = error instanceof ClarifyApiError ? error.kind : "network";
      if (kind === "attachment_expired") clearChatAttachments(requestChatId);
      updateRequestState(requestChatId, { pending: false, errorKind: kind, failedMessageId: userMessage.id });
    }
  }

  async function submitMessage(value: string) {
    const clean = value.trim();
    if (!clean || interactionLocked) return;

    const requestChat = currentChat;
    const attachments = attachmentsByChat[requestChat.id] ?? EMPTY_ATTACHMENT_STATE;
    const now = new Date().toISOString();
    const attachmentContext = attachments.pendingDisplay.map(({ document_type, agency, form_name, form_code }) => ({ document_type, agency, form_name, form_code }));
    const attachmentIds = attachments.active.map((item) => item.attachment_id);
    const userMessage: ChatMessage = { id: createMessageId(), role: "user", content: clean, attachmentContext: attachmentContext.length ? attachmentContext : undefined, createdAt: now };
    const shouldGenerateTitle = requestChat.title === DEFAULT_CHAT_TITLE && isMeaningfulMessage(clean);
    const chatWithQuestion: ChatSession = {
      ...requestChat,
      title: shouldGenerateTitle ? generateChatTitle(clean) : requestChat.title,
      messages: [...requestChat.messages, userMessage],
      updatedAt: now,
    };

    clearPendingAttachmentDisplay(requestChat.id);
    setCurrentChat(chatWithQuestion);
    persistStartedChat(chatWithQuestion);
    await completeAssistantReply(chatWithQuestion, userMessage, requestChat.messages, attachmentIds);
  }

  async function retryFailedMessage() {
    if (!requestState.failedMessageId || interactionLocked) return;
    const messageIndex = currentChat.messages.findIndex((message) => message.id === requestState.failedMessageId);
    const userMessage = currentChat.messages[messageIndex];
    if (!userMessage || userMessage.role !== "user") return;
    const attachmentIds = chatAttachments.active.map((item) => item.attachment_id);
    clearPendingAttachmentDisplay(currentChat.id);
    await completeAssistantReply(currentChat, userMessage, currentChat.messages.slice(0, messageIndex), attachmentIds);
  }

  function startNewChat() {
    const previousChat = currentChat;
    clearChatAttachments(previousChat.id);
    setUploadErrorsByChat((items) => {
      if (!items[previousChat.id]) return items;
      const remaining = { ...items };
      delete remaining[previousChat.id];
      return remaining;
    });
    if (previousChat.messages.length > 0) setCurrentChat(createDraftChat());
  }

  function viewChat(chat: ChatSession) {
    setCurrentChat(chat);
  }

  function openLatestActiveChat() {
    const activeChat = chats.find((chat) => chat.id === latestActiveChatId);
    setCurrentChat(activeChat ?? createDraftChat());
  }

  function clearConversationHistory() {
    if (interactionLocked) return;
    clearHistory();
    setChats([]);
    setLatestActiveChatId(null);
    setCurrentChat(createDraftChat());
    setRequestStateByChat({});
    setAttachmentsByChat({});
    setUploadErrorsByChat({});
  }

  async function handleUpload(file: File) {
    const chatId = currentChat.id;
    const attachments = attachmentsByChat[chatId] ?? EMPTY_ATTACHMENT_STATE;
    if (interactionLocked || attachments.active.length >= 3) return;
    setUploadingChatId(chatId);
    setUploadErrorsByChat((items) => {
      const remaining = { ...items };
      delete remaining[chatId];
      return remaining;
    });
    updateRequestState(chatId, { errorKind: null });
    try {
      const uploaded = await uploadAttachment(file);
      updateChatAttachments(chatId, (current) => ({
        active: [...current.active, uploaded],
        pendingDisplay: [...current.pendingDisplay, uploaded],
      }));
    } catch (error) {
      setUploadErrorsByChat((items) => ({ ...items, [chatId]: error instanceof Error ? error.message : "The form could not be uploaded." }));
    } finally {
      setUploadingChatId(null);
    }
  }

  function removeAttachment(attachmentId: string) {
    updateChatAttachments(currentChat.id, (current) => ({
      active: current.active.filter((item) => item.attachment_id !== attachmentId),
      pendingDisplay: current.pendingDisplay.filter((item) => item.attachment_id !== attachmentId),
    }));
    setUploadErrorsByChat((items) => {
      if (!items[currentChat.id]) return items;
      const remaining = { ...items };
      delete remaining[currentChat.id];
      return remaining;
    });
  }

  const value: ChatSessionContextValue = {
    currentChat,
    chats,
    latestActiveChatId,
    storageReady,
    requestPending: requestState.pending,
    interactionLocked,
    errorKind: requestState.errorKind,
    failedMessageId: requestState.failedMessageId,
    activeAttachments: chatAttachments.active,
    pendingAttachments: chatAttachments.pendingDisplay,
    uploading: uploadingChatId === currentChat.id,
    uploadError: uploadErrorsByChat[currentChat.id] ?? null,
    submitMessage,
    retryFailedMessage,
    startNewChat,
    viewChat,
    openLatestActiveChat,
    clearConversationHistory,
    handleUpload,
    removeAttachment,
  };

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession() {
  const context = useContext(ChatSessionContext);
  if (!context) throw new Error("useChatSession must be used within ChatSessionProvider.");
  return context;
}
