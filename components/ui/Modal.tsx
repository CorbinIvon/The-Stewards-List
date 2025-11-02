"use client";

import React, { useEffect, useRef, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal component props interface
 */
export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal content */
  children: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Modal size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes for modal container */
  className?: string;
}

/**
 * Modal component for dialog overlays
 * Provides a centered modal dialog with backdrop overlay and accessibility features.
 *
 * Features:
 * - Backdrop overlay with semi-transparent black and fixed positioning
 * - Centered modal dialog with white background
 * - Close button (X) in top-right corner
 * - Escape key to close modal
 * - Click outside (backdrop) to close modal
 * - Prevents body scroll when modal is open using useEffect
 * - Basic focus trap with first focusable element
 * - Size variants: sm (max-w-sm), md (max-w-md), lg (max-w-lg)
 * - Full accessibility with role="dialog", aria-modal, and aria-labelledby
 * - Smooth transitions and professional styling with Tailwind CSS
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * return (
 *   <>
 *     <button onClick={() => setIsOpen(true)}>Open Modal</button>
 *     <Modal
 *       isOpen={isOpen}
 *       onClose={() => setIsOpen(false)}
 *       title="Confirm Action"
 *       size="md"
 *       footer={
 *         <>
 *           <button onClick={() => setIsOpen(false)}>Cancel</button>
 *           <button>Confirm</button>
 *         </>
 *       }
 *     >
 *       Are you sure you want to proceed?
 *     </Modal>
 *   </>
 * );
 * ```
 */
const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    { isOpen, onClose, title, children, footer, size = "md", className },
    ref
  ) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstFocusableRef = useRef<HTMLButtonElement>(null);

    // Size styles map for responsive modal widths
    const sizeMap: Record<typeof size, string> = {
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
    };
    // eslint-disable-next-line security/detect-object-injection
    const sizeClassName = sizeMap[size] || sizeMap.md;

    /**
     * Handle Escape key press to close modal
     * Only closes if modal is currently open
     */
    const handleEscape = useCallback(
      (event: KeyboardEvent) => {
        if (event.key === "Escape" && isOpen) {
          onClose();
        }
      },
      [isOpen, onClose]
    );

    /**
     * Handle backdrop click to close modal
     * Only closes if click is directly on the backdrop, not nested elements
     */
    const handleBackdropClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    /**
     * Focus management and body scroll prevention
     * - Prevents body scroll when modal is open
     * - Attaches keyboard event listener for Escape key
     * - Sets focus to first focusable element (close button)
     * - Cleans up event listeners and restores scroll on unmount
     */
    useEffect(() => {
      if (!isOpen) {
        return;
      }

      // Store original overflow value for restoration
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Add escape key listener
      document.addEventListener("keydown", handleEscape);

      // Focus first focusable element (close button for basic focus trap)
      // Future enhancement: Implement full focus trap using focus-trap library
      if (firstFocusableRef.current) {
        firstFocusableRef.current.focus();
      }

      // Cleanup: restore scroll and remove listeners
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = originalOverflow;
      };
    }, [isOpen, handleEscape]);

    // Don't render anything if modal is not open (prevents unnecessary DOM nodes)
    if (!isOpen) {
      return null;
    }

    return (
      <>
        {/* Backdrop overlay - semi-transparent black with fixed positioning */}
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity"
          aria-hidden="true"
          onClick={handleBackdropClick}
        />

        {/* Modal dialog container - centered with flex layout */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
        >
          {/* Modal content box - white background with sizing variants */}
          <div
            ref={dialogRef}
            className={cn(
              "relative w-full mx-4 bg-white rounded-lg shadow-lg",
              sizeClassName,
              className
            )}
          >
            {/* Modal header with title and close button */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-200">
              <h2
                id="modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>

              {/* Close button (X) - focuses on open for basic focus trap */}
              <button
                ref={firstFocusableRef}
                onClick={onClose}
                className="inline-flex items-center justify-center p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="Close modal"
                type="button"
              >
                <svg
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal content area */}
            <div className="px-4 py-4 sm:px-6 sm:py-5">{children}</div>

            {/* Optional footer section - appears below content if provided */}
            {footer && (
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);

Modal.displayName = "Modal";

export default Modal;
