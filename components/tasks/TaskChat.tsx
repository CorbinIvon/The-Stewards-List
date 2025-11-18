"use client";

/**
 * TaskChat component - Task-attached messaging/comments interface
 * Displays messages for a specific task with ability to add new messages
 * Requires authentication and handles auto-scroll, loading, and empty states
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactElement,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { ChatWithRelations, CreateChatRequest } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import Alert from "@/components/ui/Alert";
import ChatMessage from "@/components/tasks/ChatMessage";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

/**
 * TaskChat component props
 */
export interface TaskChatProps {
  /** ID of the task to display messages for */
  taskId: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Internal state for component
 */
interface ChatState {
  messages: ChatWithRelations[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  messageInput: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TaskChat - Displays and manages task-attached messages/comments
 *
 * Features:
 * - Fetches messages on mount with loading state
 * - Displays messages in scrollable container
 * - Shows current user's messages aligned right, others aligned left
 * - Message input form at bottom with send button
 * - Auto-scrolls to newest message
 * - Empty state when no messages exist
 * - Error handling and display
 * - Requires authentication to post messages
 *
 * @param props - TaskChatProps
 * @returns TaskChat component or null if not authenticated
 */
export default function TaskChat({
  taskId,
  className,
}: TaskChatProps): ReactElement | null {
  const { user, isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: true,
    isSubmitting: false,
    error: null,
    messageInput: "",
  });

  // ========================================================================
  // EFFECTS
  // ========================================================================

  /**
   * Fetch messages on component mount
   */
  useEffect(() => {
    const fetchMessages = async (): Promise<void> => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Create a unique query key for this task's chat
        const queryKey = `task_${taskId}`;

        // Fetch messages with pagination
        const response = await apiClient.getChats(queryKey, {
          page: 1,
          pageSize: 100, // Fetch up to 100 messages per request
        });

        setState((prev) => ({
          ...prev,
          messages: response.data as ChatWithRelations[],
          isLoading: false,
        }));
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
      }
    };

    fetchMessages();
  }, [taskId]);

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    // Scroll smoothly to the bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  /**
   * Handle message input change
   */
  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      setState((prev) => ({
        ...prev,
        messageInput: e.target.value,
      }));
    },
    []
  );

  /**
   * Handle message submission
   */
  const handleSendMessage = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();

      // Validate input
      if (!state.messageInput.trim()) {
        return;
      }

      if (!user) {
        setState((prev) => ({
          ...prev,
          error: "You must be logged in to send messages",
        }));
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          isSubmitting: true,
          error: null,
        }));

        // Create message request
        const request: CreateChatRequest = {
          queryKey: `task_${taskId}`,
          message: state.messageInput.trim(),
          taskId,
        };

        // Post new message
        const newMessage = await apiClient.createChat(request);

        // Update messages list with new message
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, newMessage as ChatWithRelations],
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
      }
    },
    [taskId, state.messageInput, user]
  );

  /**
   * Dismiss error message
   */
  const handleDismissError = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardBody>
          <Alert variant="warning">
            Please log in to view and send messages
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      {/* Header */}
      <CardBody className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-300">
          Comments & Messages
        </h3>
      </CardBody>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-80 max-h-96 space-y-4 p-6"
      >
        {/* Loading State */}
        {state.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" color="primary" />
          </div>
        )}

        {/* Empty State */}
        {!state.isLoading && state.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs">
              Start a conversation by adding your first message
            </p>
          </div>
        )}

        {/* Messages List */}
        {!state.isLoading &&
          state.messages.length > 0 &&
          state.messages.map((message) => {
            const isCurrentUser = !!(user && message.userId === user.id);

            return (
              <div
                key={message.id}
                className={cn("flex", isCurrentUser ? "justify-end" : "justify-start")}
              >
                <ChatMessage message={message} isCurrentUser={isCurrentUser} />
              </div>
            );
          })}

        {/* Auto-scroll target */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Alert */}
      {state.error && (
        <div className="px-6 pt-4">
          <Alert variant="error" onDismiss={handleDismissError}>
            {state.error}
          </Alert>
        </div>
      )}

      {/* Message Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-200 space-y-4 p-6"
      >
        <Textarea
          placeholder="Type your message here... (Shift+Enter for new line)"
          value={state.messageInput}
          onChange={handleMessageChange}
          disabled={state.isSubmitting}
          rows={3}
          maxLength={1000}
          className="resize-none"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {state.messageInput.length}/1000
          </p>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!state.messageInput.trim() || state.isSubmitting}
            loading={state.isSubmitting}
          >
            Send Message
          </Button>
        </div>
      </form>
    </Card>
  );
}
