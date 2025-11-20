"use client";

/**
 * UniversalChat Component
 * Displays and manages chat messages for any resource using associativeKey
 * Supports pagination, message creation, editing, and deletion
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  UniversalChatWithRelations,
  CreateUniversalChatRequest,
} from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Alert from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface UniversalChatProps {
  /** The associative key identifying the resource (e.g., "tasks/task-id-123") */
  associativeKey: string;
  /** Additional CSS classes */
  className?: string;
}

interface ChatState {
  messages: UniversalChatWithRelations[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  messageInput: string;
  page: number;
  hasMore: boolean;
  editingId: string | null;
  editingText: string;
  deletingId: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function UniversalChat({
  associativeKey,
  className,
}: UniversalChatProps): React.ReactElement | null {
  const { user, isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: true,
    isSubmitting: false,
    error: null,
    messageInput: "",
    page: 1,
    hasMore: false,
    editingId: null,
    editingText: "",
    deletingId: null,
  });


  // ========================================================================
  // FETCH MESSAGES
  // ========================================================================

  const PAGE_SIZE = 20;

  const fetchMessagesForPage = useCallback(
    async (page: number): Promise<void> => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const response = await apiClient.getUniversalChats(associativeKey, {
          page,
          pageSize: PAGE_SIZE,
        });

        setState((prev) => ({
          ...prev,
          messages: response.data,
          hasMore: response.pagination.hasNextPage,
          page,
          isLoading: false,
        }));

        // Scroll to top of messages container
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = 0;
        }
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load messages";

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        console.error("Error fetching messages:", err);
      }
    },
    [associativeKey]
  );

  useEffect(() => {
    fetchMessagesForPage(1);
  }, [associativeKey, fetchMessagesForPage]);

  // ========================================================================
  // HANDLE MESSAGE SUBMISSION
  // ========================================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !isAuthenticated) {
      setState((prev) => ({
        ...prev,
        error: "You must be logged in to send messages",
      }));
      return;
    }

    if (!state.messageInput.trim()) {
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
      }));

      const request: CreateUniversalChatRequest = {
        associativeKey,
        message: state.messageInput.trim(),
      };

      const newMessage = await apiClient.createUniversalChat(request);

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
        messageInput: "",
        isSubmitting: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to send message";

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));

      console.error("Error sending message:", err);
    }
  };

  // ========================================================================
  // HANDLE MESSAGE EDITING
  // ========================================================================

  const startEdit = (message: UniversalChatWithRelations) => {
    setState((prev) => ({
      ...prev,
      editingId: message.id,
      editingText: message.message,
    }));
  };

  const cancelEdit = () => {
    setState((prev) => ({
      ...prev,
      editingId: null,
      editingText: "",
    }));
  };

  const saveEdit = async (messageId: string) => {
    if (!state.editingText.trim()) {
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
      }));

      const updated = await apiClient.updateUniversalChat(messageId, {
        message: state.editingText.trim(),
      });

      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === messageId ? updated : msg
        ),
        editingId: null,
        editingText: "",
        isSubmitting: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update message";

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));

      console.error("Error updating message:", err);
    }
  };

  // ========================================================================
  // HANDLE MESSAGE DELETION
  // ========================================================================

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        deletingId: messageId,
        error: null,
      }));

      await apiClient.deleteUniversalChat(messageId);

      setState((prev) => ({
        ...prev,
        messages: prev.messages.filter((msg) => msg.id !== messageId),
        deletingId: null,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete message";

      setState((prev) => ({
        ...prev,
        deletingId: null,
        error: errorMessage,
      }));

      console.error("Error deleting message:", err);
    }
  };

  // ========================================================================
  // RENDERING
  // ========================================================================

  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardBody>
          <p className="text-slate-400 text-center py-8">
            Please log in to view and participate in discussions.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardBody className="space-y-4">
        {/* Error Alert */}
        {state.error && (
          <Alert
            variant="error"
            title="Error"
            onDismiss={() =>
              setState((prev) => ({
                ...prev,
                error: null,
              }))
            }
          >
            {state.error}
          </Alert>
        )}

        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          className="bg-slate-900 rounded border border-slate-700 p-4 space-y-3 max-h-96 overflow-y-auto"
        >
          {state.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : state.messages.length === 0 ? (
            <p className="text-slate-400 text-center py-8">
              No messages yet. Be the first to start a discussion!
            </p>
          ) : (
            state.messages.map((message) => {
              const isOwner = user?.id === message.posterId;
              const isSystem = message.isSystem;

              // Render system messages differently
              if (isSystem) {
                return (
                  <div key={message.id} className="flex justify-center py-2">
                    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-xs text-slate-400 text-center">
                      <p>{message.message}</p>
                      <span className="text-xs text-slate-500">
                        {new Date(message.createdAt).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-3 border-2 border-slate-800 border-b-indigo-500 p-4 ", isOwner ? "flex-row-reverse" : "")}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    )}
                  >
                    {message.poster.displayName?.[0] ||
                      message.poster.username?.[0] ||
                      "?"}
                  </div>

                  {/* Message Content */}
                  <div
                    className={cn(
                      "flex-1 min-w-0",
                      isOwner ? "text-right" : ""
                    )}
                  >
                    {/* Header: Username and Time */}
                    <div className="flex items-center gap-2 mb-1">
                      <p
                        className={cn(
                          "text-sm font-medium text-slate-200",
                          isOwner ? "ml-auto" : ""
                        )}
                      >
                        {message.poster.displayName ||
                          message.poster.username}
                      </p>
                      <span className="text-xs text-slate-500">
                        {new Date(message.createdAt).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                      {message.isEdited && (
                        <span className="text-xs text-slate-500 italic">
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Message Body */}
                    {state.editingId === message.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={state.editingText}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              editingText: e.target.value,
                            }))
                          }
                          placeholder="Edit your message..."
                          disabled={state.isSubmitting}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => saveEdit(message.id)}
                            disabled={state.isSubmitting}
                            loading={state.isSubmitting}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={cancelEdit}
                            disabled={state.isSubmitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-100 text-sm whitespace-pre-wrap break-words">
                          {message.message}
                        </p>

                        {/* Actions: Edit/Delete */}
                        {isOwner && !message.isDeleted && !message.isSystem && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => startEdit(message)}
                              className="text-xs text-blue-400 hover:text-blue-300 transition"
                              disabled={state.isSubmitting}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteMessage(message.id)}
                              className="text-xs text-red-400 hover:text-red-300 transition"
                              disabled={
                                state.isSubmitting ||
                                state.deletingId === message.id
                              }
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </div>

        {/* Pagination Controls */}
        {!state.isLoading && state.messages.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchMessagesForPage(state.page - 1)}
              disabled={state.page === 1 || state.isLoading}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-400">
              Page {state.page}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchMessagesForPage(state.page + 1)}
              disabled={!state.hasMore || state.isLoading}
            >
              Next
            </Button>
          </div>
        )}

        {/* Message Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={state.messageInput}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                messageInput: e.target.value,
              }))
            }
            placeholder="Share your thoughts..."
            disabled={state.isSubmitting}
            rows={3}
            maxLength={5000}
            className="resize-none"
          />

          <div className="flex items-end justify-between gap-2">
            <span className="text-xs text-slate-400">
              {state.messageInput.length}/5000
            </span>
            <Button
              type="submit"
              variant="primary"
              disabled={state.isSubmitting || !state.messageInput.trim()}
              loading={state.isSubmitting}
            >
              Send
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
