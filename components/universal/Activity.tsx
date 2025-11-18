"use client";

/**
 * Activity Component
 * Displays task activity and audit trail
 * To be implemented with TaskLog data
 */

import React from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

// ============================================================================
// TYPES
// ============================================================================

export interface ActivityProps {
  /** The associative key identifying the resource (e.g., "tasks/task-id-123") */
  associativeKey: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function Activity({
  associativeKey,
  className,
}: ActivityProps): React.ReactElement {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-slate-400 text-center py-8">
          Activity timeline coming soon. Task logs and events will be displayed
          here.
        </p>
      </CardBody>
    </Card>
  );
}
